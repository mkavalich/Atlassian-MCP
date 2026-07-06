import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  createProjectSchema,
  updateProjectSchema,
  getProjectSchema,
  deleteProjectSchema,
  searchProjectsSchema,
} from '../validation/schemas.js';
import {
  createProjectInputSchema,
  getProjectInputSchema,
  updateProjectInputSchema,
  deleteProjectInputSchema,
  searchProjectsInputSchema,
} from '../validation/input-schemas.js';
import { JiraProject, CreateProjectInput } from '../types/index.js';
import { ValidationError, sanitizeErrorMessage } from '../utils/errors.js';
import { logger } from '../utils/logger.js';


export async function registerProjectTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: searchProjects (Discovery Tool - 🔍)
  server.registerTool(
    'search_projects',
    {
      title: 'Search Projects',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for project operations. Use this first to find available project IDs and keys before using other project management tools. Returns comprehensive list with IDs, keys, names, and properties needed for subsequent operations.',
      inputSchema: searchProjectsInputSchema,
      annotations: {
        title: 'Search Projects',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = searchProjectsSchema.parse(params);
        const { fields, ...apiParams } = validatedParams;

        const response = await apiClient.makeRequest<{ values: JiraProject[]; total: number; isLast: boolean }>({
          method: 'GET',
          path: '/project/search',
          params: apiParams,
        });

        if (response.success && response.data) {
          // Apply field selection for token efficiency
          const projects = fields === 'summary'
            ? response.data.values.map(p => ({
                id: p.id,
                key: p.key,
                name: p.name,
                projectTypeKey: p.projectTypeKey,
              }))
            : response.data.values;

          const hasMore = !response.data.isLast;
          const startAt = validatedParams.startAt || 0;
          const maxResults = validatedParams.maxResults || 20;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                projects,
                pagination: {
                  total: response.data.total,
                  count: projects.length,
                  startAt,
                  maxResults,
                  hasMore,
                  nextStartAt: hasMore ? startAt + projects.length : null,
                },
                fieldsMode: fields,
                usage_guidance: projects.length > 0
                  ? `Found ${projects.length} of ${response.data.total} project(s).${hasMore ? ' Use startAt=' + (startAt + projects.length) + ' for next page.' : ''} Use the returned IDs/keys with "get_project", "update_project", "delete_project".`
                  : `No projects found matching criteria. Create one with "create_project" to get started, or check your permissions.`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to search projects: No data returned');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure you have permission to view projects and check search parameters`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        // Specific error pattern matching
        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `No projects found matching search criteria`;
          nextSteps = [
            `1. Try broader search criteria or remove filters`,
            `2. Check if projects exist with "search_projects" without filters`,
            `3. If no projects exist, create one with "create_project" first`
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to view projects`;
          nextSteps = [
            '1. Verify you have Browse Projects permissions',
            '2. Contact your Jira administrator for project access',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Search parameters validation failed`;
          nextSteps = [
            '1. Check search query format and parameters',
            '2. Verify project type keys and expand parameters',
            '3. Review valid search criteria in documentation'
          ];
        }

        logger.error('Failed to search projects', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SEARCH_PROJECTS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Discovery → Validation → Action' : undefined,
                related_tools: nextSteps.length > 0 ? ['create_project'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createProject (Creation Tool - 🆕)
  server.registerTool(
    'create_project',
    {
      title: 'Create Project',
      description: '🆕 CREATE: Creates a new company-managed project (Scrum, Kanban, or Service Desk) with specified configuration. After creation, use the returned ID and key with other project management tools. Related tools: "search_projects", "get_project", "update_project".',
      inputSchema: createProjectInputSchema,
      annotations: {
        title: 'Create Project',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = createProjectSchema.parse(params);
        
        // Check for naming conventions if configured
        const namingPrefix = process.env.JIRA_PROJECT_PREFIX;
        if (namingPrefix && !validatedParams.key.startsWith(namingPrefix)) {
          throw new ValidationError(
            `Project key must start with '${namingPrefix}' according to governance rules`,
            { providedKey: validatedParams.key, requiredPrefix: namingPrefix }
          );
        }

        const requestData: CreateProjectInput = {
          name: validatedParams.name,
          key: validatedParams.key,
          projectTypeKey: validatedParams.projectTypeKey,
          description: validatedParams.description,
          leadAccountId: validatedParams.leadAccountId,
          assigneeType: validatedParams.assigneeType,
          url: validatedParams.url,
          avatarId: validatedParams.avatarId,
          projectTemplateKey: validatedParams.projectTemplateKey,
          categoryId: validatedParams.categoryId,
          notificationScheme: validatedParams.notificationScheme,
          permissionScheme: validatedParams.permissionScheme,
          issueSecurityScheme: validatedParams.issueSecurityScheme,
        };

        // Remove undefined properties to keep the request clean using Object.entries()
        const filteredEntries = Object.entries(requestData).filter(([_key, value]) => value !== undefined);
        const cleanedRequestData = Object.fromEntries(filteredEntries);

        const response = await apiClient.makeRequest<JiraProject>({
          method: 'POST',
          path: '/project',
          data: cleanedRequestData,
        });

        if (response.success && response.data) {
          logger.info('Project created successfully', { 
            projectKey: response.data.key,
            projectId: response.data.id 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                project: response.data,
                message: `Project '${response.data.name}' created successfully with key '${response.data.key}' and ID '${response.data.id}'`,
                usage_guidance: `Project has been created successfully. You can now use this project with other tools using ID '${response.data.id}' or key '${response.data.key}'.`,
                suggested_next_steps: [
                  'Verify: Check project configuration with "get_project"',
                  'Continue: Configure project settings with "update_project"',
                  'Next: Set up project workflows and permissions'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create project: No data returned');
      } catch (error: any) {
        // Enhanced error analysis for creation
        let enhancedSuggestion = `Check project configuration and permissions`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        if (error.message?.includes('key') && error.message?.includes('exists')) {
          enhancedSuggestion = `Project key '${params.key}' already exists - use a unique key`;
          nextSteps = [
            `1. Use "search_projects" to check existing project keys`,
            `2. Choose a unique project key following naming conventions`,
            `3. Retry creation with the new unique key`
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to create projects`;
          nextSteps = [
            '1. Verify you have Project Creation permissions',
            '2. Contact your Jira administrator for access',
            '3. Retry after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Project configuration validation failed`;
          nextSteps = [
            '1. Check required fields: name, key, projectTypeKey',
            '2. Verify projectTypeKey is valid (software, service_desk, business)',
            '3. Ensure key follows format: uppercase letters, numbers, underscores only'
          ];
        }

        logger.error('Failed to create project', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_PROJECT_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Ensure unique naming and proper permissions before creation' : undefined,
                related_tools: nextSteps.length > 0 ? ['search_projects'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getProject (Action Tool with Prerequisites - ⚠️)
  server.registerTool(
    'get_project',
    {
      title: 'Get Project',
      description: '⚠️ PREREQUISITE: Use "search_projects" first to find valid project IDs or keys. Get details for a specific project by ID or key. If you get "Project not found" errors, the project likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: getProjectInputSchema,
      annotations: {
        title: 'Get Project',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = getProjectSchema.parse(params);
        
        const response = await apiClient.makeRequest<JiraProject>({
          method: 'GET',
          path: `/project/${validatedParams.projectIdOrKey}`,
          params: validatedParams.expand ? { expand: validatedParams.expand } : undefined,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                project: response.data,
                usage_guidance: `Project details retrieved successfully. You can now use this project information for further operations like updates or configuration.`,
                suggested_next_steps: [
                  'Next: Update project settings with "update_project"',
                  'Consider: Review project permissions and workflows'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get project: No data returned');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure the project exists and you have permission to access it`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        // Specific error pattern matching
        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `Project ${params.projectIdOrKey || '[ID]'} not found or doesn't exist`;
          nextSteps = [
            `1. Use "search_projects" to find available project IDs and keys`,
            `2. If no projects exist, create one with "create_project" first`,
            `3. Then retry with a valid project ID or key from step 1`
          ];
          // workflowGuidance = 'The proper workflow is: Discovery → Validation → Action'; // Removed unused variable
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions for project access`;
          nextSteps = [
            '1. Verify you have Browse Projects permissions',
            '2. Contact your Jira administrator for project access',
            '3. Retry the operation after permissions are granted'
          ];
        }

        logger.error('Failed to get project', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PROJECT_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                // workflow_guidance: workflowGuidance, // Removed unused variable
                related_tools: nextSteps.length > 0 ? ['search_projects', 'create_project'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateProject (Action Tool with Prerequisites - ⚠️)
  server.registerTool(
    'update_project',
    {
      title: 'Update Project',
      description: '⚠️ PREREQUISITE: Use "search_projects" first to find valid project IDs or keys. Update an existing project\'s details, configuration, and schemes. If you get "Project not found" errors, the project likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: updateProjectInputSchema,
      annotations: {
        title: 'Update Project',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateProjectSchema.parse(params);
        
        const { projectIdOrKey, ...updateData } = validatedParams;

        // Remove undefined properties using Object.entries()
        const filteredUpdateEntries = Object.entries(updateData).filter(([_key, value]) => value !== undefined);
        const cleanedUpdateData = Object.fromEntries(filteredUpdateEntries);

        const response = await apiClient.makeRequest<JiraProject>({
          method: 'PUT',
          path: `/project/${projectIdOrKey}`,
          data: cleanedUpdateData,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                project: response.data,
                message: `Project '${response.data.name}' updated successfully`,
                usage_guidance: `Project has been updated successfully. You can now verify changes or continue with additional project management tasks.`,
                suggested_next_steps: [
                  'Verify: Check updated project configuration with "get_project"',
                  'Continue: Review project settings and further customizations'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update project: No data returned');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure the project exists and you have permission to modify it`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `Project ${params.projectIdOrKey || '[ID]'} not found or doesn't exist`;
          nextSteps = [
            `1. Use "search_projects" to find available project IDs and keys`,
            `2. If no projects exist, create one with "create_project" first`,
            `3. Then retry with a valid project ID or key from step 1`
          ];
          // workflowGuidance = 'The proper workflow is: Discovery → Validation → Action'; // Removed unused variable
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions for project modification`;
          nextSteps = [
            '1. Verify you have Project Administration permissions',
            '2. Contact your project administrator for access',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Project update configuration validation failed`;
          nextSteps = [
            '1. Check updated field values are properly formatted',
            '2. Verify scheme IDs exist and are accessible',
            '3. Use "get_project" to check current configuration'
          ];
        }

        logger.error('Failed to update project', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_PROJECT_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                // workflow_guidance: workflowGuidance, // Removed unused variable
                related_tools: nextSteps.length > 0 ? ['search_projects', 'get_project'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteProject (Action Tool with Prerequisites - ⚠️)
  server.registerTool(
    'delete_project',
    {
      title: 'Delete Project',
      description: '⚠️ PREREQUISITE: Use "search_projects" first to find valid project IDs or keys. Delete a project permanently (use with caution). If you get "Project not found" errors, the project likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: deleteProjectInputSchema,
      annotations: {
        title: 'Delete Project',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteProjectSchema.parse(params);
        
        const response = await apiClient.makeRequest({
          method: 'DELETE',
          path: `/project/${validatedParams.projectIdOrKey}`,
          params: validatedParams.enableUndo ? { enableUndo: 'true' } : undefined,
        });

        if (response.success) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Project '${validatedParams.projectIdOrKey}' deleted successfully`,
                enableUndo: validatedParams.enableUndo,
                usage_guidance: `Project has been deleted ${validatedParams.enableUndo ? 'with undo capability' : 'permanently'}. This action cannot be easily reversed without backups.`,
                suggested_next_steps: [
                  'Verify: Use "search_projects" to confirm deletion',
                  validatedParams.enableUndo ? 'Note: Undo may be available through Jira interface' : 'Warning: Deletion is permanent - ensure backups if needed'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete project');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure the project exists and you have permission to delete it`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `Project ${params.projectIdOrKey || '[ID]'} not found or doesn't exist`;
          nextSteps = [
            `1. Use "search_projects" to find available project IDs and keys`,
            `2. Verify the project hasn't already been deleted`,
            `3. Check project key/ID spelling and retry if needed`
          ];
          // workflowGuidance = 'The proper workflow is: Discovery → Validation → Action'; // Removed unused variable
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to delete project`;
          nextSteps = [
            '1. Verify you have Project Administration permissions',
            '2. Contact your Jira administrator for delete permissions',
            '3. Retry the operation after permissions are granted'
          ];
        }

        logger.error('Failed to delete project', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_PROJECT_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                // workflow_guidance: workflowGuidance, // Removed unused variable
                related_tools: nextSteps.length > 0 ? ['search_projects'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
}