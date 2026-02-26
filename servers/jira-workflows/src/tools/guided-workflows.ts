import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';
import { toolExamples } from '../validation/tool-examples.js';
import { randomUUID } from 'node:crypto';

// Input schema for guided workflow setup
const setupWorkflowGuidedInputSchema = {
  name: z.string().min(1).describe('Name for the new workflow (must be unique). Use "get_workflows" first to check availability.'),
  description: z.string().describe('Description of what this workflow will do'),
  projectKey: z.string().optional().describe('Project key where this workflow will be used (optional - for validation)'),
  workflowType: z.enum(['simple', 'development', 'sdlc', 'support', 'custom']).describe(
    'Workflow template type: "simple" (3 statuses: To Do/In Progress/Done), ' +
    '"development" (5 statuses: adds Code Review + Testing), ' +
    '"sdlc" (7+ statuses: full SDLC with UAT + Release gates), ' +
    '"support" (5 statuses: Triage-based), ' +
    '"custom" (provide your own statuses via customStatuses)'
  ),
  customStatuses: z.array(z.object({
    name: z.string().describe('Status name'),
    category: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).describe('Status category: TODO, IN_PROGRESS, or DONE')
  })).optional().describe('Custom status list (required if workflowType is "custom"). Each status needs name and category.'),
  issueTypes: z.array(z.string()).optional().describe('Issue type names that should use this workflow (optional - for scheme creation)')
};

// Strict validation schema for guided workflow setup
const setupWorkflowGuidedSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  projectKey: z.string().optional(),
  workflowType: z.enum(['simple', 'development', 'sdlc', 'support', 'custom']),
  customStatuses: z.array(z.object({
    name: z.string(),
    category: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  })).optional(),
  issueTypes: z.array(z.string()).optional(),
}).strict();

/**
 * Workflow template definition (user-friendly format matching create_workflow).
 * Uses self-referencing IDs — these are NOT Jira status IDs, they're internal references
 * that get mapped to UUIDs when calling the Jira API.
 */
interface WorkflowTemplate {
  statuses: Array<{ id: string; name: string; statusCategory: string }>;
  transitions: Array<{ name: string; from: string[]; to: string }>;
}

/**
 * Existing Jira status info (from /rest/api/3/statuses/search).
 */
interface ExistingStatus {
  id: string;
  name: string;
  statusCategory: { key: string };
  scope?: { type: string };
}

/**
 * Build the Jira API payload from the user-friendly template format.
 * Same format as create_workflow — UUIDs, toStatusReference, links.
 *
 * If existingStatuses is provided, reuses matching statuses by name
 * instead of trying to create them (which would fail with "already in use").
 */
function buildWorkflowPayload(
  name: string,
  description: string,
  template: WorkflowTemplate,
  existingStatuses?: ExistingStatus[],
): Record<string, unknown> {
  // Build a lookup of existing global statuses by lowercase name
  const existingByName = new Map<string, ExistingStatus>();
  if (existingStatuses) {
    for (const es of existingStatuses) {
      // Only reuse global statuses (not project-scoped ones)
      if (!es.scope || es.scope.type === 'GLOBAL') {
        const key = es.name.toLowerCase();
        // Keep the first match (avoid project-scoped duplicates)
        if (!existingByName.has(key)) {
          existingByName.set(key, es);
        }
      }
    }
  }

  // Map each template status to a UUID statusReference.
  // Per Atlassian: existing statuses must include `id` in the top-level array,
  // otherwise the API assumes you're creating a new status and rejects duplicate names.
  const statusIdToRef = new Map<string, string>();
  const topLevelStatuses: Array<{ statusReference: string; name: string; statusCategory: string; id?: string }> = [];

  for (const status of template.statuses) {
    const uuid = randomUUID();
    statusIdToRef.set(status.id, uuid);

    const existing = existingByName.get(status.name.toLowerCase());
    if (existing) {
      // Existing status: include `id` so Jira reuses it instead of creating a duplicate
      topLevelStatuses.push({
        statusReference: uuid,
        name: existing.name, // Use exact casing from Jira
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
  const workflowStatuses = template.statuses.map(s => ({
    statusReference: statusIdToRef.get(s.id)!,
  }));

  // Build transitions with links format
  const workflowTransitions = template.transitions.map((t, index) => {
    const isInitial = t.from.length === 0;
    const transitionId = String(index + 1);
    const toRef = statusIdToRef.get(t.to)!;

    let links: Array<{ fromStatusReference?: string; fromPort?: number; toPort: number }>;
    let transitionType: string;

    if (isInitial) {
      transitionType = 'INITIAL';
      links = [{ toPort: 1 }];
    } else {
      transitionType = 'DIRECTED';
      links = t.from.map(fromId => ({
        fromStatusReference: statusIdToRef.get(fromId)!,
        fromPort: 3,
        toPort: 7,
      }));
    }

    return {
      id: transitionId,
      name: t.name,
      type: transitionType,
      toStatusReference: toRef,
      links,
    };
  });

  return {
    scope: { type: 'GLOBAL' },
    statuses: topLevelStatuses,
    workflows: [{
      name,
      description,
      statuses: workflowStatuses,
      transitions: workflowTransitions,
    }],
  };
}

/**
 * Get predefined workflow templates.
 * Each template uses self-referencing IDs (not Jira status IDs).
 */
function getWorkflowTemplate(workflowType: string, customStatuses?: Array<{ name: string; category: string }>): WorkflowTemplate {
  switch (workflowType) {
    case 'simple':
      return {
        statuses: [
          { id: 'todo', name: 'To Do', statusCategory: 'TODO' },
          { id: 'in-progress', name: 'In Progress', statusCategory: 'IN_PROGRESS' },
          { id: 'done', name: 'Done', statusCategory: 'DONE' },
        ],
        transitions: [
          { name: 'Create', from: [], to: 'todo' },
          { name: 'Start Progress', from: ['todo'], to: 'in-progress' },
          { name: 'Done', from: ['in-progress'], to: 'done' },
          { name: 'Reopen', from: ['done'], to: 'todo' },
        ],
      };

    case 'development':
      return {
        statuses: [
          { id: 'todo', name: 'To Do', statusCategory: 'TODO' },
          { id: 'in-progress', name: 'In Progress', statusCategory: 'IN_PROGRESS' },
          { id: 'code-review', name: 'Code Review', statusCategory: 'IN_PROGRESS' },
          { id: 'testing', name: 'Testing', statusCategory: 'IN_PROGRESS' },
          { id: 'done', name: 'Done', statusCategory: 'DONE' },
        ],
        transitions: [
          { name: 'Create', from: [], to: 'todo' },
          { name: 'Start Development', from: ['todo'], to: 'in-progress' },
          { name: 'Submit for Review', from: ['in-progress'], to: 'code-review' },
          { name: 'Approve for Testing', from: ['code-review'], to: 'testing' },
          { name: 'Testing Complete', from: ['testing'], to: 'done' },
          { name: 'Return to Development', from: ['code-review', 'testing'], to: 'in-progress' },
        ],
      };

    case 'sdlc':
      return {
        statuses: [
          { id: 'backlog', name: 'Backlog', statusCategory: 'TODO' },
          { id: 'ready-for-dev', name: 'Ready for Development', statusCategory: 'TODO' },
          { id: 'in-development', name: 'In Development', statusCategory: 'IN_PROGRESS' },
          { id: 'code-review', name: 'Code Review', statusCategory: 'IN_PROGRESS' },
          { id: 'qa-testing', name: 'QA Testing', statusCategory: 'IN_PROGRESS' },
          { id: 'uat', name: 'UAT', statusCategory: 'IN_PROGRESS' },
          { id: 'ready-for-release', name: 'Ready for Release', statusCategory: 'IN_PROGRESS' },
          { id: 'done', name: 'Done', statusCategory: 'DONE' },
          { id: 'blocked', name: 'Blocked', statusCategory: 'IN_PROGRESS' },
        ],
        transitions: [
          { name: 'Create', from: [], to: 'backlog' },
          { name: 'Ready for Development', from: ['backlog'], to: 'ready-for-dev' },
          { name: 'Start Development', from: ['backlog', 'ready-for-dev'], to: 'in-development' },
          { name: 'Submit for Review', from: ['in-development'], to: 'code-review' },
          { name: 'Send to QA', from: ['code-review'], to: 'qa-testing' },
          { name: 'Return to Development', from: ['code-review', 'qa-testing', 'uat'], to: 'in-development' },
          { name: 'Promote to UAT', from: ['qa-testing'], to: 'uat' },
          { name: 'Mark Ready for Release', from: ['uat'], to: 'ready-for-release' },
          { name: 'Deploy to Production', from: ['ready-for-release'], to: 'done' },
          { name: 'Block', from: ['backlog', 'ready-for-dev', 'in-development', 'code-review', 'qa-testing', 'uat'], to: 'blocked' },
          { name: 'Unblock', from: ['blocked'], to: 'backlog' },
        ],
      };

    case 'support':
      return {
        statuses: [
          { id: 'open', name: 'Open', statusCategory: 'TODO' },
          { id: 'triaged', name: 'Triaged', statusCategory: 'TODO' },
          { id: 'in-progress', name: 'In Progress', statusCategory: 'IN_PROGRESS' },
          { id: 'resolved', name: 'Resolved', statusCategory: 'DONE' },
          { id: 'closed', name: 'Closed', statusCategory: 'DONE' },
        ],
        transitions: [
          { name: 'Create', from: [], to: 'open' },
          { name: 'Triage', from: ['open'], to: 'triaged' },
          { name: 'Start Work', from: ['triaged'], to: 'in-progress' },
          { name: 'Resolve', from: ['in-progress'], to: 'resolved' },
          { name: 'Close', from: ['resolved'], to: 'closed' },
          { name: 'Reopen', from: ['resolved', 'closed'], to: 'open' },
        ],
      };

    case 'custom': {
      if (!customStatuses || customStatuses.length === 0) {
        throw new Error('Custom workflow type requires customStatuses parameter with at least one status');
      }

      const statuses = customStatuses.map((status, index) => ({
        id: `custom-${index}`,
        name: status.name,
        statusCategory: status.category.toUpperCase(),
      }));

      // Create initial transition + linear transitions + return
      const transitions: Array<{ name: string; from: string[]; to: string }> = [
        { name: 'Create', from: [], to: statuses[0].id },
      ];

      for (let i = 0; i < statuses.length - 1; i++) {
        transitions.push({
          name: `Move to ${statuses[i + 1].name}`,
          from: [statuses[i].id],
          to: statuses[i + 1].id,
        });
      }

      // Return transition from last to first
      if (statuses.length > 1) {
        transitions.push({
          name: `Return to ${statuses[0].name}`,
          from: [statuses[statuses.length - 1].id],
          to: statuses[0].id,
        });
      }

      return { statuses, transitions };
    }

    default:
      throw new Error(`Unknown workflow type: ${workflowType}. Use: simple, development, sdlc, support, or custom`);
  }
}

export async function registerGuidedWorkflowTools(server: McpServer, apiClient: JiraApiClient) {
  server.registerTool(
    'setup_workflow_guided',
    {
      title: 'Setup Workflow (Guided)',
      description: `Guided workflow setup that handles complete workflow creation end-to-end.

PREREQUISITES:
- Use "get_workflows" first to verify your chosen name is unique
- Workflow names must be unique across the system

WORKFLOW TYPES:
- "simple": To Do -> In Progress -> Done (3 statuses)
- "development": + Code Review + Testing (5 statuses)
- "sdlc": Full SDLC with Backlog, Dev, Review, QA, UAT, Release gates (9 statuses)
- "support": Open -> Triage -> In Progress -> Resolved -> Closed (5 statuses)
- "custom": Provide your own statuses via customStatuses parameter

EXAMPLE (SDLC):
{"name": "My SDLC Workflow", "description": "Full development lifecycle", "workflowType": "sdlc"}

EXAMPLE (Custom):
{"name": "My Flow", "description": "Custom", "workflowType": "custom", "customStatuses": [{"name": "New", "category": "TODO"}, {"name": "Active", "category": "IN_PROGRESS"}, {"name": "Closed", "category": "DONE"}]}

AUTOMATED STEPS: Checks name uniqueness, generates template, creates workflow via Jira API, validates project (if provided).`,
      inputSchema: setupWorkflowGuidedInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
      examples: toolExamples['setup_workflow_guided'],
    },
    async (params) => {
      try {
        const validatedParams = setupWorkflowGuidedSchema.parse(params);
        const workflowName = validatedParams.name;
        const workflowDescription = validatedParams.description;
        const workflowType = validatedParams.workflowType;
        const projectKey = validatedParams.projectKey;
        const customStatuses = validatedParams.customStatuses;
        const issueTypes = validatedParams.issueTypes;

        if (!workflowName) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_PARAMETER',
                  message: 'Missing required parameter: name',
                  suggestion: 'Provide a unique workflow name',
                  next_steps: [
                    'Use "get_workflows" to see existing workflow names',
                    'Choose a unique name and retry'
                  ],
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        logger.info('Starting guided workflow setup', { workflowName, workflowType });

        // Step 1: Check if workflow already exists
        const existingWorkflowsResponse = await apiClient.makeRequest<{ values: any[] }>({
          method: 'GET',
          path: '/workflows/search',
          params: { workflowName: workflowName },
        });

        const exactMatch = existingWorkflowsResponse.success &&
          existingWorkflowsResponse.data?.values?.some(
            (wf: any) => wf.name === workflowName || wf.id?.name === workflowName
          );

        if (exactMatch) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'WORKFLOW_EXISTS_ERROR',
                  message: `Workflow '${workflowName}' already exists`,
                  suggestion: 'Choose a unique workflow name and retry',
                  next_steps: [
                    '1. Use "get_workflows" to see existing workflow names',
                    '2. Choose a unique name and retry this guided setup',
                    '3. Or use existing workflow in workflow scheme configuration'
                  ],
                  workflow_guidance: 'Workflow names must be unique across the system',
                  related_tools: ['get_workflows']
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Step 2: Get workflow template
        const template = getWorkflowTemplate(workflowType, customStatuses);

        // Step 3: Fetch existing statuses to avoid "name already in use" errors
        let existingStatuses: ExistingStatus[] = [];
        try {
          const statusResponse = await apiClient.makeRequest<{ values: ExistingStatus[] }>({
            method: 'GET',
            path: '/statuses/search',
          });
          if (statusResponse.success && statusResponse.data?.values) {
            existingStatuses = statusResponse.data.values;
          }
        } catch {
          // Non-fatal: if we can't fetch statuses, buildWorkflowPayload will create all as new
          logger.warn('Could not fetch existing statuses, will attempt to create all statuses');
        }

        // Step 4: Build and send Jira API payload (reuses existing statuses)
        const workflowData = buildWorkflowPayload(
          workflowName,
          workflowDescription || '',
          template,
          existingStatuses,
        );

        const createResponse = await apiClient.makeRequest<any>({
          method: 'POST',
          path: '/workflows/create',
          data: workflowData,
        });

        if (!createResponse.success) {
          throw new Error(`Failed to create workflow: ${createResponse.error?.message || 'Unknown error'}`);
        }

        logger.info('Workflow created successfully via guided setup', { workflowName });

        // Step 5: Optionally validate project if provided
        let projectValidation = null;
        if (projectKey) {
          try {
            const projectResponse = await apiClient.makeRequest<any>({
              method: 'GET',
              path: `/project/${projectKey}`,
            });

            if (projectResponse.success) {
              projectValidation = {
                valid: true,
                projectName: projectResponse.data.name,
                projectId: projectResponse.data.id
              };
            } else {
              projectValidation = {
                valid: false,
                message: `Project '${projectKey}' not found or not accessible`
              };
            }
          } catch (error) {
            projectValidation = {
              valid: false,
              message: `Unable to validate project '${projectKey}': ${error}`
            };
          }
        }

        // Step 6: Prepare response
        const createdWorkflow = createResponse.data.workflows?.[0] || createResponse.data;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              workflow: createdWorkflow,
              workflowSummary: {
                name: workflowName,
                type: workflowType,
                statusCount: template.statuses.length,
                transitionCount: template.transitions.length,
                statuses: template.statuses.map(s => s.name),
              },
              projectValidation: projectValidation,
              message: `Workflow '${workflowName}' created successfully via guided setup with ${template.statuses.length} statuses and ${template.transitions.length} transitions`,
              usage_guidance: `Workflow has been created and is ready for use. ${projectValidation?.valid ? `Validated against project '${projectValidation.projectName}'.` : ''} You can now create a workflow scheme to assign this workflow to projects and issue types.`,
              suggested_next_steps: [
                'Verify: Review created workflow with "get_workflows"',
                'Next: Create workflow scheme to assign this workflow to projects',
                issueTypes?.length ? `Configure: Map workflow to issue types: ${issueTypes.join(', ')}` : 'Configure: Determine which issue types should use this workflow',
                projectValidation?.valid ? `Deploy: Assign workflow scheme to project '${projectKey}'` : 'Deploy: Choose target projects for this workflow',
                'Test: Verify workflow transitions work as expected'
              ],
              automated_steps_completed: [
                'Checked for existing workflows with same name',
                `Generated ${workflowType} workflow template`,
                'Created workflow with proper status references and API format',
                'Validated workflow structure',
                projectValidation ? 'Validated target project' : 'Project validation skipped (no projectKey provided)'
              ],
            }, null, 2),
          }],
        };

      } catch (error: any) {
        let enhancedSuggestion = 'Guided workflow setup encountered an issue';
        let nextSteps: string[] = [];
        let workflowGuidance: string | undefined;

        if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = 'Insufficient permissions for guided workflow setup';
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for workflow creation access',
            '3. Retry guided setup after permissions are granted'
          ];
          workflowGuidance = 'Guided workflow setup requires full workflow creation permissions';
        } else if (error.message?.includes('requires customStatuses')) {
          enhancedSuggestion = 'Custom workflow type requires customStatuses parameter';
          nextSteps = [
            '1. Provide customStatuses array with status names and categories',
            '2. Each status needs: name (string) and category ("TODO", "IN_PROGRESS", "DONE")',
            '3. Or choose a different workflowType: "simple", "development", "sdlc", "support"'
          ];
          workflowGuidance = 'Custom workflows need explicit status definitions';
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST') || error.message?.includes('Bad request')) {
          enhancedSuggestion = 'Workflow configuration validation failed during guided setup';
          nextSteps = [
            '1. Check name is unique and follows naming conventions',
            '2. Verify workflowType is valid: simple, development, sdlc, support, or custom',
            '3. For custom type, ensure customStatuses array is properly formatted',
            '4. Retry with corrected parameters'
          ];
          workflowGuidance = 'Guided setup validates all parameters before workflow creation';
        }

        logger.error('Failed guided workflow setup', { error: error.message, workflowName: params.name });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GUIDED_WORKFLOW_SETUP_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: workflowGuidance || 'Guided workflow setup automates complex workflow creation',
                related_tools: ['get_workflows', 'create_workflow'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
}
