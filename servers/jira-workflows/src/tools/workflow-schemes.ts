import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getWorkflowSchemesSchema,
  createWorkflowSchemeSchema,
  updateWorkflowSchemeSchema,
  // REMOVED: deleteWorkflowSchemeSchema - Cloud API limitation
  assignWorkflowSchemeToProjectSchema,
  // REMOVED: getWorkflowSchemeProjectsSchema - Cloud API limitation
  // REMOVED: getWorkflowSchemeIssueTypesSchema - Cloud API limitation
  setWorkflowSchemeIssueTypeSchema,
  deleteWorkflowSchemeIssueTypeSchema,
} from '../validation/schemas.js';
import {
  getWorkflowSchemesInputSchema,
  createWorkflowSchemeInputSchema,
  updateWorkflowSchemeInputSchema,
  // REMOVED: deleteWorkflowSchemeInputSchema - Cloud API limitation
  assignWorkflowSchemeToProjectInputSchema,
  // REMOVED: getWorkflowSchemeProjectsInputSchema - Cloud API limitation
  // REMOVED: getWorkflowSchemeIssueTypesInputSchema - Cloud API limitation
  setWorkflowSchemeIssueTypeInputSchema,
  deleteWorkflowSchemeIssueTypeInputSchema,
} from '../validation/input-schemas.js';
import { ValidationError, sanitizeErrorMessage } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export async function registerWorkflowSchemeTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getWorkflowSchemesDetailed - DISCOVERY TOOL (Enhanced with UX patterns)
  server.registerTool(
    'get_workflow_schemes_detailed',
    {
      title: 'Get Workflow Schemes',
      description: '🔍 DISCOVERY TOOL: Use this first to find available workflow scheme IDs before using other workflow scheme management tools. Returns comprehensive list with IDs needed for assign_workflow_scheme_to_project and update_workflow_scheme operations.',
      inputSchema: getWorkflowSchemesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getWorkflowSchemesSchema.parse(params);

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/workflowscheme',
          params: {
            startAt: validatedParams.startAt,
            maxResults: validatedParams.maxResults,
            expand: validatedParams.expand,
          },
        });

        if (response.success && response.data) {
          const schemes = response.data.values || response.data;
          const count = Array.isArray(schemes) ? schemes.length : 0;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                schemes: schemes,
                total: response.data.total || count,
                startAt: response.data.startAt || 0,
                maxResults: response.data.maxResults || 50,
                isLast: response.data.isLast,
                count: count,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve workflow schemes: No data returned');
      } catch (error: any) {
        logger.error('Failed to get workflow schemes', { error: error.message });
        
        let enhancedSuggestion = 'Ensure you have Jira Administrator permissions to view workflow schemes';
        let nextSteps: string[] = [];

        if (error.message?.includes('Unauthorized') || error.message?.includes('403')) {
          enhancedSuggestion = 'You do not have permission to view workflow schemes';
          nextSteps = [
            '1. Ensure you have "Jira Administrator" global permission',
            '2. Contact your Jira administrator to grant workflow scheme access',
            '3. Workflow schemes require system administrator privileges'
          ];
        } else if (error.message?.includes('500') || error.message?.includes('Internal')) {
          enhancedSuggestion = 'Server error while retrieving workflow schemes';
          nextSteps = [
            '1. Try again in a few moments',
            '2. Contact your system administrator if the error persists',
            '3. Check Jira server health and connectivity'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_WORKFLOW_SCHEMES_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Resolve permissions first, then retry workflow scheme discovery' : undefined,
                permission_help: {
                  required: 'Jira Administrator global permission',
                  note: 'Workflow scheme management requires system admin privileges'
                }
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createWorkflowScheme - Enhanced with validation
  server.registerTool(
    'create_workflow_scheme',
    {
      title: 'Create Workflow Scheme',
      description: '✅ Create a new workflow scheme with issue type mappings. Creates a workflow scheme that can be discovered with "get_workflow_schemes_detailed" and assigned to projects.',
      inputSchema: createWorkflowSchemeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createWorkflowSchemeSchema.parse(params);
        
        // Build the workflow scheme data structure
        const schemeData: any = {
          name: validatedParams.name,
          description: validatedParams.description,
        };

        // Add default workflow if specified
        if (validatedParams.defaultWorkflow) {
          schemeData.defaultWorkflow = validatedParams.defaultWorkflow;
        }

        // Add issue type mappings if provided
        if (validatedParams.issueTypeMappings && validatedParams.issueTypeMappings.length > 0) {
          // Use Object.fromEntries() instead of bracket notation
          const mappingEntries = validatedParams.issueTypeMappings
            .filter(mapping => mapping && mapping.issueType && mapping.workflow)
            .map(mapping => [mapping.issueType, mapping.workflow]);
          schemeData.issueTypeMappings = Object.fromEntries(mappingEntries);
        }

        const response = await apiClient.makeRequest<any>({
          method: 'POST',
          path: '/workflowscheme',
          data: schemeData,
        });

        if (response.success && response.data) {
          logger.info('Workflow scheme created successfully', { 
            schemeName: validatedParams.name,
            schemeId: response.data.id,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                scheme: response.data,
                message: `Workflow scheme '${validatedParams.name}' created successfully with ID: ${response.data.id}`,
                usage_guidance: `Workflow scheme ID ${response.data.id} can now be used with other workflow scheme tools.`,
                suggested_next_steps: [
                  `Use "assign_workflow_scheme_to_project" with ID ${response.data.id} to assign to a project`,
                  'Use "set_workflow_scheme_issue_type" to add issue type workflow mappings',
                  'Use "update_workflow_scheme" to modify scheme settings'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create workflow scheme: No data returned');
      } catch (error: any) {
        logger.error('Failed to create workflow scheme', { error: error.message });
        
        let enhancedSuggestion = 'Ensure you have Jira Administrator permissions and that the workflow names are valid';
        let nextSteps: string[] = [];

        if (error.message?.includes('name') && error.message?.includes('already exists')) {
          enhancedSuggestion = 'Workflow scheme name already exists';
          nextSteps = [
            '1. Choose a different workflow scheme name',
            '2. Use "get_workflow_schemes_detailed" to see existing scheme names',
            '3. Retry with unique name'
          ];
        } else if (error.message?.includes('workflow') && error.message?.includes('not found')) {
          enhancedSuggestion = 'Referenced workflow does not exist';
          nextSteps = [
            '1. Verify workflow names are correct and exist in your Jira instance',
            '2. Check default workflow and issue type mapping workflow names',
            '3. Use Jira admin interface to verify available workflows',
            '4. Create missing workflows first, then retry scheme creation'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = 'You do not have permission to create workflow schemes';
          nextSteps = [
            '1. Ensure you have "Jira Administrator" global permission',
            '2. Contact your Jira administrator for workflow scheme creation rights',
            '3. Workflow scheme management requires system admin privileges'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_WORKFLOW_SCHEME_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Resolve the issue above, then retry workflow scheme creation' : undefined,
                permission_help: {
                  required: 'Jira Administrator global permission',
                  note: 'Workflow scheme creation requires system admin privileges'
                }
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateWorkflowScheme - Enhanced with prerequisite warnings
  server.registerTool(
    'update_workflow_scheme',
    {
      title: 'Update Workflow Scheme',
      description: '⚠️ PREREQUISITE: Use "get_workflow_schemes_detailed" first to discover valid scheme IDs. Updates an existing workflow scheme name, description, or default workflow. If you get "Scheme not found" errors, the ID likely doesn\'t exist or you need to discover it first.',
      inputSchema: updateWorkflowSchemeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateWorkflowSchemeSchema.parse(params);
        
        // Build update data structure
        const updateData: any = {};
        
        if (validatedParams.name !== undefined) {
          updateData.name = validatedParams.name;
        }
        
        if (validatedParams.description !== undefined) {
          updateData.description = validatedParams.description;
        }
        
        if (validatedParams.defaultWorkflow !== undefined) {
          updateData.defaultWorkflow = validatedParams.defaultWorkflow;
        }

        if (Object.keys(updateData).length === 0) {
          throw new ValidationError('At least one field must be provided for update');
        }

        const response = await apiClient.makeRequest<any>({
          method: 'PUT',
          path: `/workflowscheme/${validatedParams.schemeId}`,
          data: updateData,
        });

        if (response.success) {
          logger.info('Workflow scheme updated successfully', { 
            schemeId: validatedParams.schemeId,
            updates: Object.keys(updateData),
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                scheme: response.data,
                message: `Workflow scheme ${validatedParams.schemeId} updated successfully`,
                updatedFields: Object.keys(updateData),
                usage_guidance: `Workflow scheme ${validatedParams.schemeId} has been updated.`,
                suggested_next_steps: [
                  `Use "get_workflow_schemes_detailed" to see updated information`,
                  'Use "get_workflow_schemes_detailed" to verify which projects use this scheme',
                  'Use "assign_workflow_scheme_to_project" if you need to apply changes to new projects'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update workflow scheme');
      } catch (error: any) {
        logger.error('Failed to update workflow scheme', { error: error.message });
        
        let enhancedSuggestion = 'Ensure you have Jira Administrator permissions and the scheme ID is valid';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND') || error.message?.includes('404')) {
          enhancedSuggestion = `Workflow scheme ID ${params.schemeId} not found`;
          nextSteps = [
            '1. Use "get_workflow_schemes_detailed" to find available scheme IDs',
            '2. If no schemes exist, create one with "create_workflow_scheme" first',
            '3. Then retry with a valid scheme ID from step 1'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = `You do not have permission to update workflow scheme ${params.schemeId}`;
          nextSteps = [
            '1. Ensure you have "Jira Administrator" global permission',
            '2. Contact your Jira administrator for workflow scheme modification rights',
            '3. Workflow scheme management requires system admin privileges'
          ];
        } else if (error.message?.includes('workflow') && error.message?.includes('not found')) {
          enhancedSuggestion = 'Referenced workflow in update does not exist';
          nextSteps = [
            '1. Verify the defaultWorkflow name is correct and exists',
            '2. Use Jira admin interface to check available workflows',
            '3. Create the missing workflow first, then retry the update'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_WORKFLOW_SCHEME_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Discovery → Validation → Action' : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: delete_workflow_scheme - Cloud API limitation (cannot delete workflow schemes via API)
  // REMOVED: get_workflow_scheme_projects - Cloud API limitation (endpoint returns incorrect data)
  // REMOVED: get_workflow_scheme_issue_types - Cloud API limitation (endpoint not available)

  // Tool: assignWorkflowSchemeToProject - Greenfield project assignment
  server.registerTool(
    'assign_workflow_scheme_to_project',
    {
      title: 'Assign Workflow Scheme to Project',
      description: '⚠️ GREENFIELD PROJECTS ONLY: Assigns a workflow scheme to a classic Jira project. CRITICAL PREREQUISITE: The target project must have NO existing issues — this API endpoint only works on empty/new projects. Use "get_workflow_schemes_detailed" first to discover valid scheme IDs. Requires Jira Administrator permission. Does NOT work on team-managed (next-gen) projects.',
      inputSchema: assignWorkflowSchemeToProjectInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = assignWorkflowSchemeToProjectSchema.parse(params);

        const response = await apiClient.makeRequest<any>({
          method: 'PUT',
          path: '/workflowscheme/project',
          data: {
            workflowSchemeId: validatedParams.schemeId,
            projectId: validatedParams.projectIdOrKey,
          },
        });

        if (response.success) {
          logger.info('Workflow scheme assigned to project successfully', {
            schemeId: validatedParams.schemeId,
            projectId: validatedParams.projectIdOrKey,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Workflow scheme ${validatedParams.schemeId} assigned to project ${validatedParams.projectIdOrKey} successfully`,
                assignment: {
                  schemeId: validatedParams.schemeId,
                  projectId: validatedParams.projectIdOrKey,
                },
                usage_guidance: 'The project now uses the assigned workflow scheme for all new issues.',
                suggested_next_steps: [
                  'Use "set_workflow_scheme_issue_type" to customize issue type workflow mappings',
                  'Use "get_workflow_schemes_detailed" to verify the assignment',
                  'Create a test issue in the project to verify the workflow is active'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to assign workflow scheme to project');
      } catch (error: any) {
        logger.error('Failed to assign workflow scheme to project', { error: error.message });

        let enhancedSuggestion = 'Ensure you have Jira Administrator permissions and both the scheme ID and project ID are valid';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') && error.message?.includes('scheme')) {
          enhancedSuggestion = `Workflow scheme ID ${params.schemeId} not found`;
          nextSteps = [
            '1. Use "get_workflow_schemes_detailed" to find available workflow scheme IDs',
            '2. If no workflow schemes exist, create one with "create_workflow_scheme" first',
            '3. Then retry with a valid scheme ID from step 1'
          ];
        } else if (error.message?.includes('not found') && error.message?.includes('project')) {
          enhancedSuggestion = `Project ${params.projectIdOrKey} not found`;
          nextSteps = [
            '1. Verify the project ID or key is correct',
            '2. Ensure the project exists and is a classic (company-managed) project',
            '3. Team-managed (next-gen) projects cannot use custom workflow schemes via API'
          ];
        } else if (error.message?.includes('issues') || error.message?.includes('not empty') || error.message?.includes('migration')) {
          enhancedSuggestion = 'The project has existing issues — workflow scheme assignment only works on empty/greenfield projects';
          nextSteps = [
            '1. This API endpoint only works on projects with NO existing issues',
            '2. For projects with existing issues, use the Jira UI: Project Settings → Workflows → Switch Scheme',
            '3. Alternatively, create a new empty project and assign the scheme before creating issues'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized') || error.message?.includes('403')) {
          enhancedSuggestion = 'You do not have permission to assign workflow schemes';
          nextSteps = [
            '1. Ensure you have "Jira Administrator" global permission',
            '2. Contact your Jira administrator for workflow scheme assignment rights',
            '3. Workflow scheme assignment requires system admin privileges'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ASSIGN_WORKFLOW_SCHEME_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Scheme Discovery → Project Validation → Assignment' : undefined,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: setWorkflowSchemeIssueType - CRITICAL HIGH-RISK TOOL - Complex dependency chain
  server.registerTool(
    'set_workflow_scheme_issue_type',
    {
      title: 'Set Workflow Scheme Issue Type',
      description: '⚠️ MULTIPLE PREREQUISITES AND LIMITATIONS: Use "get_workflow_schemes_detailed" first to find scheme IDs. CRITICAL: Active workflow schemes (those assigned to projects) CANNOT be modified via API - you will get a validation error. Only INACTIVE/DRAFT schemes can have issue type mappings changed. Verify the scheme is not in use before attempting modifications.',
      inputSchema: setWorkflowSchemeIssueTypeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = setWorkflowSchemeIssueTypeSchema.parse(params);
        
        const response = await apiClient.makeRequest<any>({
          method: 'PUT',
          path: `/workflowscheme/${validatedParams.schemeId}/issuetype/${validatedParams.issueType}`,
          data: {
            workflow: validatedParams.workflow,
          },
        });

        if (response.success) {
          logger.info('Workflow scheme issue type mapping updated successfully', { 
            schemeId: validatedParams.schemeId,
            issueType: validatedParams.issueType,
            workflow: validatedParams.workflow,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Issue type ${validatedParams.issueType} in scheme ${validatedParams.schemeId} now uses workflow '${validatedParams.workflow}'`,
                mapping: {
                  schemeId: validatedParams.schemeId,
                  issueType: validatedParams.issueType,
                  workflow: validatedParams.workflow,
                },
                usage_guidance: `Issue type mapping updated successfully.`,
                suggested_next_steps: [
                  'Use "get_workflow_schemes_detailed" to view all mappings for this scheme',
                  'Use "assign_workflow_scheme_to_project" if this scheme needs to be applied to projects',
                  'Test the workflow assignment by creating issues of this type in assigned projects'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to set workflow scheme issue type mapping');
      } catch (error: any) {
        logger.error('Failed to set workflow scheme issue type', { error: error.message });
        
        let enhancedSuggestion = 'Ensure you have Jira Administrator permissions and both the scheme ID and workflow name are valid';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') && error.message?.includes('scheme')) {
          enhancedSuggestion = `Workflow scheme ID ${params.schemeId} not found`;
          nextSteps = [
            '1. Use "get_workflow_schemes_detailed" to find available workflow scheme IDs',
            '2. If no workflow schemes exist, create one with "create_workflow_scheme" first',
            '3. Then retry with a valid scheme ID from step 1'
          ];
        } else if (error.message?.includes('not found') && error.message?.includes('workflow')) {
          enhancedSuggestion = `Workflow '${params.workflow}' not found`;
          nextSteps = [
            '1. Verify the workflow name is correct and exists in your Jira instance',
            '2. Use Jira admin interface to check available workflows',
            '3. Create the missing workflow first, then retry the mapping',
            '4. Workflow names are case-sensitive'
          ];
        } else if (error.message?.includes('issue type') || error.message?.includes('issuetype')) {
          enhancedSuggestion = `Issue type '${params.issueType}' not found or invalid`;
          nextSteps = [
            '1. Use valid issue type IDs (usually numeric) or names',
            '2. Check available issue types in Jira admin interface',
            '3. Common issue types: Bug, Task, Story, Epic',
            '4. Issue type references are case-sensitive'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SET_WORKFLOW_SCHEME_ISSUE_TYPE_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Scheme Discovery → Workflow Validation → Issue Type Validation → Mapping' : undefined,
                dependency_help: {
                  scheme_discovery: 'Use "get_workflow_schemes_detailed" for scheme IDs',
                  workflow_validation: 'Check Jira admin interface for available workflows',
                  issue_type_validation: 'Common issue types: Bug, Task, Story, Epic'
                }
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteWorkflowSchemeIssueType - Enhanced with dependencies
  server.registerTool(
    'delete_workflow_scheme_issue_type',
    {
      title: 'Delete Workflow Scheme Issue Type',
      description: '⚠️ PREREQUISITE: Use "get_workflow_schemes_detailed" first to discover valid scheme IDs and current issue type mappings. Removes an issue type mapping from a workflow scheme (reverts to default workflow).',
      inputSchema: deleteWorkflowSchemeIssueTypeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteWorkflowSchemeIssueTypeSchema.parse(params);
        
        const response = await apiClient.makeRequest<any>({
          method: 'DELETE',
          path: `/workflowscheme/${validatedParams.schemeId}/issuetype/${validatedParams.issueType}`,
        });

        if (response.success) {
          logger.info('Workflow scheme issue type mapping deleted successfully', { 
            schemeId: validatedParams.schemeId,
            issueType: validatedParams.issueType,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Issue type ${validatedParams.issueType} removed from scheme ${validatedParams.schemeId} (will use default workflow)`,
                removed: {
                  schemeId: validatedParams.schemeId,
                  issueType: validatedParams.issueType,
                },
                usage_guidance: `Issue type mapping removed. The issue type will now use the scheme's default workflow.`,
                suggested_next_steps: [
                  'Use "get_workflow_schemes_detailed" to verify the mapping was removed',
                  'The issue type will now use the default workflow for this scheme',
                  'Use "set_workflow_scheme_issue_type" to create a new mapping if needed'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete workflow scheme issue type mapping');
      } catch (error: any) {
        logger.error('Failed to delete workflow scheme issue type', { error: error.message });
        
        let enhancedSuggestion = 'Ensure you have Jira Administrator permissions and both the scheme ID and issue type ID are valid';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') && error.message?.includes('scheme')) {
          enhancedSuggestion = `Workflow scheme ID ${params.schemeId} not found`;
          nextSteps = [
            '1. Use "get_workflow_schemes_detailed" to find available workflow scheme IDs',
            '2. If no workflow schemes exist, create one with "create_workflow_scheme" first',
            '3. Then retry with a valid scheme ID from step 1'
          ];
        } else if (error.message?.includes('not found') && (error.message?.includes('issue type') || error.message?.includes('mapping'))) {
          enhancedSuggestion = `Issue type '${params.issueType}' mapping not found in scheme ${params.schemeId}`;
          nextSteps = [
            '1. Use "get_workflow_schemes_detailed" to see current mappings for this scheme',
            '2. The issue type mapping may not exist (already using default workflow)',
            '3. Verify the issue type ID or name is correct'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_WORKFLOW_SCHEME_ISSUE_TYPE_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Discovery → Validation → Action' : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Workflow scheme tools registered successfully (logging disabled for MCP compatibility)
}