import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { randomUUID } from 'crypto';
import {
  getStatusesSchema,
  getWorkflowsSchema,
  createWorkflowSchema,
  deleteWorkflowSchema,
} from '../validation/schemas.js';
import {
  getStatusesInputSchema,
  getWorkflowsInputSchema,
  createWorkflowInputSchema,
  getAllWorkflowsInputSchema,
  deleteWorkflowInputSchema,
} from '../validation/input-schemas.js';
import { JiraWorkflow } from '../types/index.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { toolExamples } from '../validation/tool-examples.js';


export async function registerWorkflowTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getStatuses (Discovery Tool - 🔍)
  // Prerequisite tool for workflow creation - discovers valid status IDs and categories
  server.registerTool(
    'get_statuses',
    {
      title: 'Get Statuses',
      description: `🔍 DISCOVERY TOOL: Primary discovery method for workflow status operations. Use this FIRST before creating workflows to discover available status IDs and their categories.

Returns all statuses in the Jira instance with:
- id: The status ID to use in workflow definitions
- name: Display name of the status
- statusCategory: Category (TODO, IN_PROGRESS, DONE) that determines board column

⚠️ PREREQUISITE for create_workflow:
Use this tool to find valid status IDs before creating workflows. The status categories returned here must match your workflow status definitions.

📋 EXAMPLE USAGE:
1. Call get_statuses to discover available statuses
2. Note the status IDs and their categories
3. Use those IDs in your workflow transitions`,
      inputSchema: getStatusesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getStatusesSchema.parse(params);

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/status',
          params: {
            expand: validatedParams.expand,
          },
        });

        if (response.success && response.data) {
          // Response can be array directly or wrapped in values
          const statuses = Array.isArray(response.data) ? response.data : (response.data.values || []);

          // Map to simpler format with category info for easy consumption
          const mappedStatuses = statuses.map((status: any) => ({
            id: status.id,
            name: status.name,
            description: status.description,
            statusCategory: {
              id: status.statusCategory?.id,
              key: status.statusCategory?.key,
              name: status.statusCategory?.name,
              colorName: status.statusCategory?.colorName,
            },
            scope: status.scope,
            usages: status.usages,
          }));

          // Group by category for easier workflow planning
          const byCategory = {
            TODO: mappedStatuses.filter((s: any) => s.statusCategory?.key === 'new'),
            IN_PROGRESS: mappedStatuses.filter((s: any) => s.statusCategory?.key === 'indeterminate'),
            DONE: mappedStatuses.filter((s: any) => s.statusCategory?.key === 'done'),
          };

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                statuses: mappedStatuses,
                count: mappedStatuses.length,
                byCategory: byCategory,
                usage_guidance: 'Use status IDs from this list when creating workflows. Map categories: "new" = TODO, "indeterminate" = IN_PROGRESS, "done" = DONE',
                suggested_next_steps: [
                  'Review available statuses and their categories',
                  'Use "create_workflow" with valid status IDs from this list',
                  'Ensure your workflow has at least one status from each needed category',
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve statuses: No data returned');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = 'Ensure you have permission to view statuses';
        let nextSteps: string[] = [];

        if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = 'Insufficient permissions to view statuses';
          nextSteps = [
            '1. Verify you have Browse Projects permission',
            '2. Contact your Jira administrator for status access',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = 'Status query validation failed';
          nextSteps = [
            '1. Check expand parameter format',
            '2. Valid expand values: usages',
            '3. Retry without expand parameter'
          ];
        }

        logger.error('Failed to get statuses', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_STATUSES_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                related_tools: ['get_workflows', 'create_workflow']
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getWorkflows (Discovery Tool - 🔍)
  server.registerTool(
    'get_workflows',
    {
      title: 'Get Workflows',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for workflow operations. Use this first to find available workflow names and configurations before using other workflow management tools. Returns comprehensive list with names, statuses, transitions, and properties needed for subsequent operations.',
      inputSchema: getWorkflowsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getWorkflowsSchema.parse(params);

        // Use the new search endpoint as the old one is being deprecated
        const response = await apiClient.makeRequest<{ values: JiraWorkflow[] }>({
          method: 'GET',
          path: '/workflows/search',
          params: {
            workflowName: validatedParams.workflowName,
            expand: validatedParams.expand,
          },
        });

        if (response.success && response.data) {
          const workflows = response.data.values || response.data;
          const count = Array.isArray(workflows) ? workflows.length : Array.isArray(response.data) ? response.data.length : 0;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                workflows: workflows,
                count: count,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve workflows: No data returned');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure you have permission to view workflows and check search parameters`;
        let nextSteps: string[] = [];
        
        // Specific error pattern matching
        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `No workflows found matching search criteria`;
          nextSteps = [
            `1. Try broader search criteria or remove workflowName filter`,
            `2. Check if workflows exist with "get_workflows" without filters`,
            `3. If no workflows exist, create one with "create_workflow" first`
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to view workflows`;
          nextSteps = [
            '1. Verify you have Browse Projects and Jira Administration permissions',
            '2. Contact your Jira administrator for workflow access',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Workflow search parameters validation failed`;
          nextSteps = [
            '1. Check workflowName parameter format',
            '2. Verify expand parameters are valid (transitions, statuses)',
            '3. Review search criteria and try again'
          ];
        }

        logger.error('Failed to get workflows', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_WORKFLOWS_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Workflows define how issues move through statuses - ensure proper access' : undefined,
                related_tools: nextSteps.length > 0 ? ['create_workflow', 'get_workflow_schemes_basic'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createWorkflow (Creation Tool - 🆕)
  server.registerTool(
    'create_workflow',
    {
      title: 'Create Workflow',
      description: `🆕 CREATE: Creates a new workflow with statuses and transitions.

⚠️ PREREQUISITES:
- Use "get_workflows" first to check workflow name is unique
- Workflow name cannot contain special characters except underscore

📋 REQUIRED STRUCTURE:
- statuses: Array of {id, name, statusCategory} where statusCategory is "TODO", "IN_PROGRESS", or "DONE"
- transitions: Array of {name, from, to} where from is array of status ids (empty array [] for initial transition)

📝 EXAMPLE (simple 3-status workflow):
{
  "name": "Simple Workflow",
  "description": "Basic workflow",
  "statuses": [
    {"id": "todo", "name": "To Do", "statusCategory": "TODO"},
    {"id": "in-progress", "name": "In Progress", "statusCategory": "IN_PROGRESS"},
    {"id": "done", "name": "Done", "statusCategory": "DONE"}
  ],
  "transitions": [
    {"name": "Create", "from": [], "to": "todo"},
    {"name": "Start", "from": ["todo"], "to": "in-progress"},
    {"name": "Complete", "from": ["in-progress"], "to": "done"}
  ]
}

CRITICAL: Must have at least one INITIAL transition (from: []) that creates issues.`,
      inputSchema: createWorkflowInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
      examples: toolExamples['create_workflow'],
    },
    async (params) => {
      try {
        const validatedParams = createWorkflowSchema.parse(params);
        
        // Validate workflow structure
        if (validatedParams.transitions.length === 0) {
          throw new ValidationError('Workflow must have at least one transition');
        }

        if (validatedParams.statuses.length === 0) {
          throw new ValidationError('Workflow must have at least one status');
        }

        // Check that all transition statuses exist
        const statusIds = new Set(validatedParams.statuses.map(s => s.id));
        for (const transition of validatedParams.transitions) {
          for (const fromStatus of transition.from) {
            if (!statusIds.has(fromStatus)) {
              throw new ValidationError(
                `Transition '${transition.name}' references non-existent 'from' status: ${fromStatus}`
              );
            }
          }
          if (!statusIds.has(transition.to)) {
            throw new ValidationError(
              `Transition '${transition.name}' references non-existent 'to' status: ${transition.to}`
            );
          }
        }

        // Build workflow data using new API format (discovered Jan 2026)
        // API requires: scope, top-level statuses with UUIDs, and workflows with toStatusReference/links
        // IMPORTANT: Reuse existing Jira statuses by name to avoid "name already in use" errors

        // Fetch existing statuses to check for name conflicts
        interface ExistingStatusInfo {
          id: string;
          name: string;
          statusCategory: { key: string };
          scope?: { type: string };
        }
        let existingStatuses: ExistingStatusInfo[] = [];
        try {
          const statusSearchResponse = await apiClient.makeRequest<{ values: ExistingStatusInfo[] }>({
            method: 'GET',
            path: '/statuses/search',
          });
          if (statusSearchResponse.success && statusSearchResponse.data?.values) {
            existingStatuses = statusSearchResponse.data.values;
          }
        } catch {
          // Non-fatal: will try to create all statuses as new
        }

        // Build lookup of existing global statuses by lowercase name
        const existingByName = new Map<string, ExistingStatusInfo>();
        for (const es of existingStatuses) {
          if (!es.scope || es.scope.type === 'GLOBAL') {
            const key = es.name.toLowerCase();
            if (!existingByName.has(key)) {
              existingByName.set(key, es);
            }
          }
        }

        // Map each status to a UUID statusReference.
        // Per Atlassian: existing statuses must include `id` in the top-level array,
        // otherwise the API assumes you're creating new and rejects duplicate names.
        const statusIdToRef = new Map<string, string>();
        const topLevelStatuses: Array<{ statusReference: string; name: string; statusCategory: string; id?: string }> = [];

        for (const status of validatedParams.statuses) {
          const uuid = randomUUID();
          statusIdToRef.set(status.id, uuid);

          const existing = existingByName.get(status.name.toLowerCase());
          if (existing) {
            // Existing status: include `id` so Jira reuses it
            topLevelStatuses.push({
              statusReference: uuid,
              name: existing.name,
              statusCategory: status.statusCategory.toUpperCase(),
              id: existing.id,
            });
          } else {
            // New status: no `id` — Jira creates it
            topLevelStatuses.push({
              statusReference: uuid,
              name: status.name,
              statusCategory: status.statusCategory.toUpperCase(),
            });
          }
        }

        // Workflow-level statuses reference all statuses via UUID
        const workflowStatuses = validatedParams.statuses.map(s => ({
          statusReference: statusIdToRef.get(s.id)!,
        }));

        // Build transitions with new links format
        const workflowTransitions = validatedParams.transitions.map((t, index) => {
          const isInitial = t.from.length === 0;
          const transitionId = String(index + 1);
          const toRef = statusIdToRef.get(t.to)!;

          // Build links array based on transition type
          let links: Array<{ fromStatusReference?: string; fromPort?: number; toPort: number }>;
          let transitionType: string;

          if (isInitial) {
            // INITIAL transition: just toPort, no source
            transitionType = 'INITIAL';
            links = [{ toPort: 1 }];
          } else {
            // DIRECTED transition: one link per source status
            transitionType = 'DIRECTED';
            links = t.from.map(fromId => ({
              fromStatusReference: statusIdToRef.get(fromId)!,
              fromPort: 3,  // Standard outgoing port
              toPort: 7,    // Standard incoming port
            }));
          }

          return {
            id: transitionId,
            name: t.name,
            type: transitionType,
            toStatusReference: toRef,
            links,
            ...(t.conditions?.length && { conditions: t.conditions }),
            ...(t.validators?.length && { validators: t.validators }),
            ...(t.postFunctions?.length && { postFunctions: t.postFunctions }),
          };
        });

        const workflowData = {
          scope: { type: 'GLOBAL' },
          statuses: topLevelStatuses,
          workflows: [{
            name: validatedParams.name,
            description: validatedParams.description,
            statuses: workflowStatuses,
            transitions: workflowTransitions,
          }],
        };

        const response = await apiClient.makeRequest<any>({
          method: 'POST',
          path: '/workflows/create',
          data: workflowData,
        });

        if (response.success && response.data) {
          const workflow = response.data.workflows?.[0] || response.data;
          
          logger.info('Workflow created successfully', { 
            workflowName: validatedParams.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                workflow: workflow,
                message: `Workflow '${validatedParams.name}' created successfully with ${validatedParams.statuses.length} statuses and ${validatedParams.transitions.length} transitions`,
                usage_guidance: `Workflow has been created successfully. You can now use this workflow '${validatedParams.name}' in workflow schemes and assign it to projects.`,
                suggested_next_steps: [
                  'Verify: Check workflow configuration with "get_workflows"',
                  'Continue: Add to workflow schemes for project assignment',
                  'Next: Configure workflow schemes with detailed tools',
                  'Consider: Test workflow transitions in a test project'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create workflow: No data returned');
      } catch (error: any) {
        // Enhanced error analysis for creation
        let enhancedSuggestion = `Check workflow configuration and permissions`;
        let nextSteps: string[] = [];
        
        if (error.message?.includes('name') && error.message?.includes('exists')) {
          enhancedSuggestion = `Workflow name '${params.name}' already exists - use a unique name`;
          nextSteps = [
            `1. Use "get_workflows" to check existing workflow names`,
            `2. Choose a unique workflow name`,
            `3. Retry creation with the new unique name`
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to create workflows`;
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for workflow creation access',
            '3. Retry after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Workflow configuration validation failed`;
          nextSteps = [
            '1. Check required fields: name, description, statuses, transitions',
            '2. Verify all transition from/to status references exist in statuses array',
            '3. Ensure at least one status and one transition are defined',
            '4. Check status and transition IDs are unique and properly formatted'
          ];
        } else if (error instanceof ValidationError) {
          enhancedSuggestion = `Workflow structure validation failed: ${error.message}`;
          nextSteps = [
            '1. Review the specific validation error above',
            '2. Ensure all transition from/to statuses exist in the statuses array',
            '3. Verify status IDs are consistent across transitions and statuses',
            '4. Check that workflow has at least one status and one transition'
          ];
        }

        logger.error('Failed to create workflow', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_WORKFLOW_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: 'Ensure unique naming, proper permissions, and valid workflow structure',
                related_tools: nextSteps.length > 0 ? ['get_workflows'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getWorkflowSchemesBasic (Discovery Tool - 🔍)
  server.registerTool(
    'get_workflow_schemes_basic',
    {
      title: 'Get Workflow Schemes Basic',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for workflow scheme operations. Use this first to find available workflow scheme IDs and their project associations before using detailed workflow scheme management tools. Returns basic scheme information needed for subsequent operations.',
      inputSchema: getAllWorkflowsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/workflowscheme',
          params: {
            startAt: params.startAt || 0,
            maxResults: params.maxResults || 50,
          },
        });

        if (response.success && response.data) {
          const schemes = response.data.values || response.data;
          const total = response.data.total || 0;
          const count = Array.isArray(schemes) ? schemes.length : 0;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                schemes: schemes,
                total: total,
                count: count,
                startAt: response.data.startAt,
                maxResults: response.data.maxResults,
                isLast: response.data.isLast,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve workflow schemes');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure you have permission to view workflow schemes`;
        let nextSteps: string[] = [];
        
        if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to view workflow schemes`;
          nextSteps = [
            '1. Verify you have Browse Projects and Jira Administration permissions',
            '2. Contact your Jira administrator for workflow scheme access',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Workflow scheme query validation failed`;
          nextSteps = [
            '1. Check pagination parameters (startAt, maxResults)',
            '2. Ensure startAt is non-negative and maxResults is reasonable (1-100)',
            '3. Review query format and try again'
          ];
        }

        logger.error('Failed to get workflow schemes', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_WORKFLOW_SCHEMES_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Workflow schemes organize workflows for project configuration' : undefined,
                related_tools: nextSteps.length > 0 ? ['get_workflows'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteWorkflow (Deletion Tool - ⚠️)
  server.registerTool(
    'delete_workflow',
    {
      title: 'Delete Workflow',
      description: 'Deletes a Jira workflow by its entity ID. The workflow must not be in use by any active workflow schemes. Use get_workflows to find the entityId.',
      inputSchema: deleteWorkflowInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteWorkflowSchema.parse(params);

        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/workflow/${validatedParams.entityId}`,
        });

        if (response.success) {
          logger.info('Workflow deleted successfully', {
            entityId: validatedParams.entityId,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Workflow with entityId '${validatedParams.entityId}' deleted successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete workflow: No success response');
      } catch (error: any) {
        let enhancedSuggestion = 'Ensure the workflow exists and is not in use';
        let nextSteps: string[] = [];

        if (error.message?.includes('400') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = 'Workflow may be in use by a workflow scheme. Remove it from all schemes first.';
          nextSteps = [
            '1. Use "get_workflow_schemes_detailed" to find schemes using this workflow',
            '2. Remove the workflow from all schemes',
            '3. Retry the deletion',
          ];
        } else if (error.message?.includes('404') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = 'Workflow not found. Use get_workflows to verify the entityId.';
          nextSteps = [
            '1. Use "get_workflows" to list available workflows and find the correct entityId',
            '2. Verify the entityId is in UUID format',
            '3. Retry with the correct entityId',
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = 'Insufficient permissions to delete workflows';
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for workflow deletion access',
            '3. Retry after permissions are granted',
          ];
        }

        logger.error('Failed to delete workflow', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_WORKFLOW_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                related_tools: ['get_workflows', 'get_workflow_schemes_detailed'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Workflow tools registered successfully (logging disabled for MCP compatibility)
}