import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getIssueTypesSchema,
  createIssueTypeSchema,
  updateIssueTypeSchema,
  deleteIssueTypeSchema,
  getIssueTypeSchemesSchema,
  createIssueTypeSchemeSchema,
  updateIssueTypeSchemeSchema,
  deleteIssueTypeSchemeSchema,
  getIssueTypeSchemeMappingsSchema,
  addIssueTypesToSchemeSchema,
  assignIssueTypeSchemeToProjectSchema,
  getIssueCreatemetaFieldsSchema,
  getIssueCreatemetaIssuetypesSchema,
} from '../validation/schemas.js';
import {
  getIssueTypesInputSchema,
  createIssueTypeInputSchema,
  updateIssueTypeInputSchema,
  deleteIssueTypeInputSchema,
  getIssueTypeSchemesInputSchema,
  createIssueTypeSchemeInputSchema,
  updateIssueTypeSchemeInputSchema,
  deleteIssueTypeSchemeInputSchema,
  getIssueTypeSchemeMappingsInputSchema,
  addIssueTypesToSchemeInputSchema,
  assignIssueTypeSchemeToProjectInputSchema,
  getIssueCreatemetaFieldsInputSchema,
  getIssueCreatemetaIssuetypesInputSchema,
} from '../validation/input-schemas.js';
import { JiraIssueType, JiraIssueTypeScheme } from '../types/index.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { toolExamples } from '../validation/tool-examples.js';

export async function registerIssueTypeTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getIssueTypes (Discovery Tool - 🔍)
  server.registerTool(
    'get_issue_types',
    {
      title: 'Get Issue Types',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for issue type operations. Use this first to find available issue type IDs before using other issue type management tools. Returns comprehensive list with IDs, names, and properties needed for subsequent operations.',
      inputSchema: getIssueTypesInputSchema,
      annotations: {
        title: 'Get Issue Types',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = getIssueTypesSchema.parse(params);
        const { fields, expand } = validatedParams;

        const response = await apiClient.makeRequest<JiraIssueType[]>({
          method: 'GET',
          path: '/issuetype',
          params: expand ? { expand } : undefined,
        });

        if (response.success && response.data) {
          // Apply field selection for token efficiency
          const issueTypes = fields === 'summary'
            ? response.data.map(t => ({
                id: t.id,
                name: t.name,
                subtask: t.subtask,
              }))
            : response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueTypes,
                count: issueTypes.length,
                fieldsMode: fields,
                usage_guidance: issueTypes.length > 0
                  ? `Found ${issueTypes.length} issue type(s). Use IDs with "create_issue_type", "update_issue_type", "delete_issue_type".`
                  : `No issue types found. Contact your Jira administrator as issue types are required for projects.`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve issue types');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure you have permission to view issue types`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        // Specific error pattern matching
        if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to view issue types`;
          nextSteps = [
            '1. Verify you have Browse Projects permissions',
            '2. Contact your Jira administrator for access',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Issue type query validation failed`;
          nextSteps = [
            '1. Check expand parameters are valid',
            '2. Review query format and try again',
            '3. Remove optional parameters and retry'
          ];
        }

        logger.error('Failed to get issue types', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ISSUE_TYPES_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Issue types are fundamental to Jira - ensure proper access' : undefined,
                related_tools: nextSteps.length > 0 ? ['get_issue_type_schemes'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createIssueType (Creation Tool - 🆕)
  server.registerTool(
    'create_issue_type',
    {
      title: 'Create Issue Type',
      description: '🆕 CREATE: Creates a new issue type with specified configuration. After creation, use the returned ID with other issue type management tools. Related tools: "get_issue_types", "update_issue_type", "get_issue_type_schemes".',
      inputSchema: createIssueTypeInputSchema,
      annotations: {
        title: 'Create Issue Type',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = createIssueTypeSchema.parse(params);
        
        const response = await apiClient.makeRequest<JiraIssueType>({
          method: 'POST',
          path: '/issuetype',
          data: validatedParams,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueType: response.data,
                message: `Issue type '${response.data.name}' created successfully with ID '${response.data.id}'`,
                usage_guidance: `Issue type has been created successfully. You can now use this issue type with other tools using ID '${response.data.id}'.`,
                suggested_next_steps: [
                  'Verify: Check issue type configuration with "get_issue_types"',
                  'Continue: Add to issue type schemes with "get_issue_type_schemes"',
                  'Next: Configure workflows for this issue type'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create issue type');
      } catch (error: any) {
        // Enhanced error analysis for creation
        let enhancedSuggestion = `Check issue type configuration and permissions`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        if (error.message?.includes('name') && error.message?.includes('exists')) {
          enhancedSuggestion = `Issue type name '${params.name}' already exists - use a unique name`;
          nextSteps = [
            `1. Use "get_issue_types" to check existing issue type names`,
            `2. Choose a unique issue type name`,
            `3. Retry creation with the new unique name`
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to create issue types`;
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for access',
            '3. Retry after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Issue type configuration validation failed`;
          nextSteps = [
            '1. Check required fields: name, description, type (subtask/standard)',
            '2. Verify icon/avatar configuration is valid',
            '3. Ensure type field is either "subtask" or "standard"'
          ];
        }

        logger.error('Failed to create issue type', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_ISSUE_TYPE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Ensure unique naming and system admin permissions' : undefined,
                related_tools: nextSteps.length > 0 ? ['get_issue_types'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateIssueType (Action Tool with Prerequisites - ⚠️)
  server.registerTool(
    'update_issue_type',
    {
      title: 'Update Issue Type',
      description: '⚠️ PREREQUISITE: Use "get_issue_types" first to find valid issue type IDs. Update an existing issue type configuration. If you get "Issue type not found" errors, the issue type likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: updateIssueTypeInputSchema,
      annotations: {
        title: 'Update Issue Type',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateIssueTypeSchema.parse(params);
        
        const { issueTypeId, ...updateData } = validatedParams;

        const response = await apiClient.makeRequest<JiraIssueType>({
          method: 'PUT',
          path: `/issuetype/${issueTypeId}`,
          data: updateData,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueType: response.data,
                message: `Issue type '${response.data.name}' updated successfully`,
                usage_guidance: `Issue type has been updated successfully. Changes may take time to propagate across all projects using this issue type.`,
                suggested_next_steps: [
                  'Verify: Check updated issue type with "get_issue_types"',
                  'Continue: Review projects using this issue type'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update issue type');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure the issue type exists and you have permission to modify it`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `Issue type ID ${params.issueTypeId || '[ID]'} not found or doesn't exist`;
          nextSteps = [
            `1. Use "get_issue_types" to find available issue type IDs`,
            `2. Verify the issue type hasn't been deleted`,
            `3. Then retry with a valid issue type ID from step 1`
          ];
          // workflowGuidance = 'The proper workflow is: Discovery → Validation → Action'; // Removed unused variable
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions for issue type modification`;
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for access',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Issue type update validation failed`;
          nextSteps = [
            '1. Check updated field values are properly formatted',
            '2. Verify avatar/icon configuration if changed',
            '3. Use "get_issue_types" to check current configuration'
          ];
        }

        logger.error('Failed to update issue type', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_ISSUE_TYPE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                // workflow_guidance: workflowGuidance, // Removed unused variable
                related_tools: nextSteps.length > 0 ? ['get_issue_types'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteIssueType (Action Tool with Prerequisites - ⚠️)
  server.registerTool(
    'delete_issue_type',
    {
      title: 'Delete Issue Type',
      description: '⚠️ PREREQUISITE: Use "get_issue_types" first to find valid issue type IDs. Delete an issue type (with optional alternative for existing issues). If you get "Issue type not found" errors, the issue type likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: deleteIssueTypeInputSchema,
      annotations: {
        title: 'Delete Issue Type',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteIssueTypeSchema.parse(params);
        
        const queryParams: any = {};
        if (validatedParams.alternativeIssueTypeId) {
          queryParams.alternativeIssueTypeId = validatedParams.alternativeIssueTypeId;
        }

        const response = await apiClient.makeRequest({
          method: 'DELETE',
          path: `/issuetype/${validatedParams.issueTypeId}`,
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Issue type deleted successfully`,
                alternativeIssueTypeId: validatedParams.alternativeIssueTypeId,
                usage_guidance: `Issue type has been deleted. ${validatedParams.alternativeIssueTypeId ? 'Existing issues have been migrated to the alternative issue type.' : 'Ensure no existing issues use this type.'}`,
                suggested_next_steps: [
                  'Verify: Use "get_issue_types" to confirm deletion',
                  validatedParams.alternativeIssueTypeId ? 'Check: Verify issues were migrated to alternative type' : 'Warning: Existing issues may be affected'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete issue type');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure the issue type exists and can be safely deleted`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `Issue type ID ${params.issueTypeId || '[ID]'} not found or doesn't exist`;
          nextSteps = [
            `1. Use "get_issue_types" to find available issue type IDs`,
            `2. Verify the issue type hasn't already been deleted`,
            `3. Check issue type ID spelling and retry if needed`
          ];
          // workflowGuidance = 'The proper workflow is: Discovery → Validation → Action'; // Removed unused variable
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to delete issue type`;
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for delete permissions',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('in use') || error.message?.includes('conflict')) {
          enhancedSuggestion = `Issue type is in use and cannot be deleted without alternative`;
          nextSteps = [
            '1. Use "get_issue_types" to find an alternative issue type ID',
            '2. Retry deletion with alternativeIssueTypeId parameter',
            '3. Existing issues will be migrated to the alternative type'
          ];
        }

        logger.error('Failed to delete issue type', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_ISSUE_TYPE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                // workflow_guidance: workflowGuidance, // Removed unused variable
                related_tools: nextSteps.length > 0 ? ['get_issue_types'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getIssueTypeSchemes (Discovery Tool - 🔍)
  server.registerTool(
    'get_issue_type_schemes',
    {
      title: 'Get Issue Type Schemes',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for issue type scheme operations. Use this first to find available scheme IDs before using other scheme management tools. Returns comprehensive list with IDs, names, and properties needed for subsequent operations.',
      inputSchema: getIssueTypeSchemesInputSchema,
      annotations: {
        title: 'Get Issue Type Schemes',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = getIssueTypeSchemesSchema.parse(params);
        const { fields, ...apiParams } = validatedParams;

        const response = await apiClient.makeRequest<{ values: JiraIssueTypeScheme[]; total: number }>({
          method: 'GET',
          path: '/issuetypescheme',
          params: apiParams,
        });

        if (response.success && response.data) {
          const rawSchemes = response.data.values || response.data;
          const total = response.data.total || (Array.isArray(rawSchemes) ? rawSchemes.length : 0);

          // Apply field selection for token efficiency
          const schemes = fields === 'summary'
            ? (Array.isArray(rawSchemes) ? rawSchemes : []).map((s: JiraIssueTypeScheme) => ({
                id: s.id,
                name: s.name,
              }))
            : rawSchemes;

          const count = Array.isArray(schemes) ? schemes.length : 0;
          const startAt = validatedParams.startAt || 0;
          const maxResults = validatedParams.maxResults || 20;
          const hasMore = startAt + count < total;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueTypeSchemes: schemes,
                pagination: {
                  total,
                  count,
                  startAt,
                  maxResults,
                  hasMore,
                  nextStartAt: hasMore ? startAt + count : null,
                },
                fieldsMode: fields,
                usage_guidance: count > 0
                  ? `Found ${count} of ${total} scheme(s).${hasMore ? ' Use startAt=' + (startAt + count) + ' for next page.' : ''} Use IDs with scheme management tools.`
                  : `No issue type schemes found. Create one with "create_issue_type_scheme".`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve issue type schemes');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure you have permission to view issue type schemes`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to view issue type schemes`;
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for access',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Issue type scheme query validation failed`;
          nextSteps = [
            '1. Check pagination parameters (startAt, maxResults)',
            '2. Review query format and try again',
            '3. Remove optional parameters and retry'
          ];
        }

        logger.error('Failed to get issue type schemes', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ISSUE_TYPE_SCHEMES_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Issue type schemes organize issue types for projects' : undefined,
                related_tools: nextSteps.length > 0 ? ['create_issue_type_scheme'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createIssueTypeScheme (Creation Tool - 🆕)
  server.registerTool(
    'create_issue_type_scheme',
    {
      title: 'Create Issue Type Scheme',
      description: '🆕 CREATE: Creates a new issue type scheme with specified configuration. After creation, use the returned ID with other scheme management tools. Related tools: "get_issue_type_schemes", "update_issue_type_scheme", "get_issue_types".',
      inputSchema: createIssueTypeSchemeInputSchema,
      annotations: {
        title: 'Create Issue Type Scheme',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      examples: toolExamples['create_issue_type_scheme'],
    },
    async (params) => {
      try {
        const validatedParams = createIssueTypeSchemeSchema.parse(params);
        
        const response = await apiClient.makeRequest<JiraIssueTypeScheme>({
          method: 'POST',
          path: '/issuetypescheme',
          data: validatedParams,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueTypeScheme: response.data,
                message: `Issue type scheme '${response.data.name}' created successfully with ID '${response.data.id}'`,
                usage_guidance: `Issue type scheme has been created successfully. You can now assign this scheme to projects and configure issue types within it.`,
                suggested_next_steps: [
                  'Verify: Check scheme configuration with "get_issue_type_schemes"',
                  'Continue: Configure issue types for this scheme',
                  'Next: Assign scheme to projects that need these issue types'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create issue type scheme');
      } catch (error: any) {
        // Enhanced error analysis for creation
        let enhancedSuggestion = `Check issue type scheme configuration and permissions`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        if (error.message?.includes('name') && error.message?.includes('exists')) {
          enhancedSuggestion = `Issue type scheme name '${params.name}' already exists - use a unique name`;
          nextSteps = [
            `1. Use "get_issue_type_schemes" to check existing scheme names`,
            `2. Choose a unique issue type scheme name`,
            `3. Retry creation with the new unique name`
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to create issue type schemes`;
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for access',
            '3. Retry after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Issue type scheme configuration validation failed`;
          nextSteps = [
            '1. Check required fields: name and description',
            '2. Verify issue type IDs are valid if specified',
            '3. Use "get_issue_types" to find valid issue type IDs'
          ];
        }

        logger.error('Failed to create issue type scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_ISSUE_TYPE_SCHEME_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Ensure unique naming and valid issue type references' : undefined,
                related_tools: nextSteps.length > 0 ? ['get_issue_type_schemes', 'get_issue_types'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateIssueTypeScheme (Action Tool with Prerequisites - ⚠️)
  server.registerTool(
    'update_issue_type_scheme',
    {
      title: 'Update Issue Type Scheme',
      description: '⚠️ PREREQUISITE: Use "get_issue_type_schemes" first to find valid scheme IDs. Update an existing issue type scheme configuration. If you get "Scheme not found" errors, the scheme likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: updateIssueTypeSchemeInputSchema,
      annotations: {
        title: 'Update Issue Type Scheme',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateIssueTypeSchemeSchema.parse(params);
        
        const { schemeId, ...updateData } = validatedParams;

        const response = await apiClient.makeRequest<JiraIssueTypeScheme>({
          method: 'PUT',
          path: `/issuetypescheme/${schemeId}`,
          data: updateData,
        });

        // PUT may return 204 No Content (success with no body) or 200 with data
        if (response.success) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueTypeScheme: response.data || { id: schemeId, ...updateData },
                message: `Issue type scheme ${schemeId} updated successfully`,
                usage_guidance: `Issue type scheme has been updated successfully. Changes will be reflected in projects using this scheme.`,
                suggested_next_steps: [
                  'Verify: Check updated scheme with "get_issue_type_schemes"',
                  'Continue: Review projects affected by this change'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update issue type scheme');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure the issue type scheme exists and you have permission to modify it`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `Issue type scheme ID ${params.schemeId || '[ID]'} not found or doesn't exist`;
          nextSteps = [
            `1. Use "get_issue_type_schemes" to find available scheme IDs`,
            `2. Verify the scheme hasn't been deleted`,
            `3. Then retry with a valid scheme ID from step 1`
          ];
          // workflowGuidance = 'The proper workflow is: Discovery → Validation → Action'; // Removed unused variable
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions for issue type scheme modification`;
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for access',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = `Issue type scheme update validation failed`;
          nextSteps = [
            '1. Check updated field values are properly formatted',
            '2. Verify issue type IDs exist if specified',
            '3. Use "get_issue_types" to validate issue type references'
          ];
        }

        logger.error('Failed to update issue type scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_ISSUE_TYPE_SCHEME_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                // workflow_guidance: workflowGuidance, // Removed unused variable
                related_tools: nextSteps.length > 0 ? ['get_issue_type_schemes', 'get_issue_types'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteIssueTypeScheme (Action Tool with Prerequisites - ⚠️)
  server.registerTool(
    'delete_issue_type_scheme',
    {
      title: 'Delete Issue Type Scheme',
      description: '⚠️ PREREQUISITE: Use "get_issue_type_schemes" first to find valid scheme IDs. Delete an issue type scheme (ensure no projects are using it). If you get "Scheme not found" errors, the scheme likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: deleteIssueTypeSchemeInputSchema,
      annotations: {
        title: 'Delete Issue Type Scheme',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteIssueTypeSchemeSchema.parse(params);
        
        const response = await apiClient.makeRequest({
          method: 'DELETE',
          path: `/issuetypescheme/${validatedParams.schemeId}`,
        });

        if (response.success) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Issue type scheme deleted successfully',
                usage_guidance: `Issue type scheme has been deleted. Projects that were using this scheme may need to be assigned a different scheme.`,
                suggested_next_steps: [
                  'Verify: Use "get_issue_type_schemes" to confirm deletion',
                  'Check: Review projects that may have been affected',
                  'Consider: Assign alternative schemes to affected projects'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete issue type scheme');
      } catch (error: any) {
        // Enhanced error analysis
        let enhancedSuggestion = `Ensure the issue type scheme exists and is not in use by projects`;
        let nextSteps: string[] = [];
        // let workflowGuidance: string | undefined; // Removed unused variable
        
        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `Issue type scheme ID ${params.schemeId || '[ID]'} not found or doesn't exist`;
          nextSteps = [
            `1. Use "get_issue_type_schemes" to find available scheme IDs`,
            `2. Verify the scheme hasn't already been deleted`,
            `3. Check scheme ID spelling and retry if needed`
          ];
          // workflowGuidance = 'The proper workflow is: Discovery → Validation → Action'; // Removed unused variable
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions to delete issue type scheme`;
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for delete permissions',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('in use') || error.message?.includes('conflict')) {
          enhancedSuggestion = `Issue type scheme is in use by projects and cannot be deleted`;
          nextSteps = [
            '1. Identify projects using this scheme',
            '2. Assign alternative schemes to those projects first',
            '3. Retry deletion after all projects are migrated'
          ];
        }

        logger.error('Failed to delete issue type scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_ISSUE_TYPE_SCHEME_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                // workflow_guidance: workflowGuidance, // Removed unused variable
                related_tools: nextSteps.length > 0 ? ['get_issue_type_schemes'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getIssueTypeSchemeMappings (Discovery Tool - 🔍)
  server.registerTool(
    'get_issue_type_scheme_mappings',
    {
      title: 'Get Issue Type Scheme Mappings',
      description: `🔍 DISCOVERY TOOL: Get mappings between issue type schemes and projects. Use this to discover which projects use which issue type schemes.

Returns project-to-scheme mappings with:
- projectId: The project ID
- issueTypeSchemeId: The scheme assigned to that project

⚠️ PREREQUISITE for assign_issue_type_scheme_to_project:
Use this tool to verify current scheme assignments before modifying them.`,
      inputSchema: getIssueTypeSchemeMappingsInputSchema,
      annotations: {
        title: 'Get Issue Type Scheme Mappings',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = getIssueTypeSchemeMappingsSchema.parse(params);

        const queryParams: Record<string, any> = {
          startAt: validatedParams.startAt,
          maxResults: validatedParams.maxResults,
        };

        if (validatedParams.projectId && validatedParams.projectId.length > 0) {
          queryParams.projectId = validatedParams.projectId;
        }

        const response = await apiClient.makeRequest<{ values: any[]; total?: number }>({
          method: 'GET',
          path: '/issuetypescheme/project',
          params: queryParams,
        });

        if (response.success && response.data) {
          const mappings = response.data.values || response.data;
          const total = response.data.total || (Array.isArray(mappings) ? mappings.length : 0);
          const count = Array.isArray(mappings) ? mappings.length : 0;
          const startAt = validatedParams.startAt || 0;
          const maxResults = validatedParams.maxResults || 50;
          const hasMore = startAt + count < total;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                mappings: mappings,
                pagination: {
                  total,
                  count,
                  startAt,
                  maxResults,
                  hasMore,
                  nextStartAt: hasMore ? startAt + count : null,
                },
                usage_guidance: count > 0
                  ? `Found ${count} of ${total} mapping(s).${hasMore ? ' Use startAt=' + (startAt + count) + ' for next page.' : ''} Use with "assign_issue_type_scheme_to_project" to change assignments.`
                  : 'No scheme mappings found. Projects may be using the default scheme.',
                suggested_next_steps: [
                  'Review current scheme assignments',
                  'Use "assign_issue_type_scheme_to_project" to change a project\'s scheme',
                  'Use "get_issue_type_schemes" to find available schemes'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve issue type scheme mappings');
      } catch (error: any) {
        let enhancedSuggestion = 'Ensure you have permission to view issue type scheme mappings';
        let nextSteps: string[] = [];

        if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = 'Insufficient permissions to view scheme mappings';
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for access',
            '3. Retry the operation after permissions are granted'
          ];
        }

        logger.error('Failed to get issue type scheme mappings', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ISSUE_TYPE_SCHEME_MAPPINGS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                related_tools: ['get_issue_type_schemes', 'assign_issue_type_scheme_to_project']
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: addIssueTypesToScheme (Action Tool - ⚙️)
  server.registerTool(
    'add_issue_types_to_scheme',
    {
      title: 'Add Issue Types to Scheme',
      description: `⚙️ ACTION: Add issue types to an existing issue type scheme.

⚠️ PREREQUISITES:
1. Use "get_issue_type_schemes" to find the scheme ID
2. Use "get_issue_types" to find valid issue type IDs to add

Note: This adds issue types without removing existing ones. The default issue type must remain in the scheme.`,
      inputSchema: addIssueTypesToSchemeInputSchema,
      annotations: {
        title: 'Add Issue Types to Scheme',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = addIssueTypesToSchemeSchema.parse(params);

        const response = await apiClient.makeRequest({
          method: 'PUT',
          path: `/issuetypescheme/${validatedParams.schemeId}/issuetype`,
          data: {
            issueTypeIds: validatedParams.issueTypeIds,
          },
        });

        if (response.success) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Successfully added ${validatedParams.issueTypeIds.length} issue type(s) to scheme ${validatedParams.schemeId}`,
                schemeId: validatedParams.schemeId,
                addedIssueTypeIds: validatedParams.issueTypeIds,
                usage_guidance: 'Issue types have been added to the scheme. Projects using this scheme will now have access to these issue types.',
                suggested_next_steps: [
                  'Verify: Use "get_issue_type_schemes" with expand to see updated scheme',
                  'Continue: Check projects using this scheme',
                  'Note: Existing issues are not affected'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add issue types to scheme');
      } catch (error: any) {
        let enhancedSuggestion = 'Ensure the scheme exists and issue type IDs are valid';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `Scheme ID ${params.schemeId || '[ID]'} or issue type IDs not found`;
          nextSteps = [
            '1. Use "get_issue_type_schemes" to find valid scheme IDs',
            '2. Use "get_issue_types" to find valid issue type IDs',
            '3. Retry with valid IDs from those discovery tools'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = 'Insufficient permissions to modify issue type schemes';
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Contact your Jira administrator for access',
            '3. Retry the operation after permissions are granted'
          ];
        } else if (error.message?.includes('already') || error.message?.includes('duplicate')) {
          enhancedSuggestion = 'One or more issue types are already in the scheme';
          nextSteps = [
            '1. Use "get_issue_type_schemes" with expand to see current issue types',
            '2. Remove duplicates from your issueTypeIds array',
            '3. Retry with only the new issue types to add'
          ];
        }

        logger.error('Failed to add issue types to scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_ISSUE_TYPES_TO_SCHEME_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                related_tools: ['get_issue_type_schemes', 'get_issue_types']
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: assignIssueTypeSchemeToProject (Action Tool - ⚙️)
  server.registerTool(
    'assign_issue_type_scheme_to_project',
    {
      title: 'Assign Issue Type Scheme to Project',
      description: `⚙️ ACTION: Assign an issue type scheme to a project. This determines which issue types are available for creating issues in that project.

⚠️ PREREQUISITES:
1. Use "get_issue_type_schemes" to find the scheme ID
2. Use "search_projects" to find the project ID
3. Use "get_issue_type_scheme_mappings" to check current assignment

⚠️ IMPORTANT: Changing a project's issue type scheme may affect which issue types users can select when creating issues.`,
      inputSchema: assignIssueTypeSchemeToProjectInputSchema,
      annotations: {
        title: 'Assign Issue Type Scheme to Project',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = assignIssueTypeSchemeToProjectSchema.parse(params);

        const response = await apiClient.makeRequest({
          method: 'PUT',
          path: '/issuetypescheme/project',
          data: {
            issueTypeSchemeId: validatedParams.issueTypeSchemeId,
            projectId: validatedParams.projectId,
          },
        });

        if (response.success) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Successfully assigned issue type scheme ${validatedParams.issueTypeSchemeId} to project ${validatedParams.projectId}`,
                projectId: validatedParams.projectId,
                issueTypeSchemeId: validatedParams.issueTypeSchemeId,
                usage_guidance: 'The project now uses the specified issue type scheme. Users creating issues in this project will see the issue types defined in this scheme.',
                suggested_next_steps: [
                  'Verify: Use "get_issue_type_scheme_mappings" to confirm assignment',
                  'Note: Existing issues retain their current issue types',
                  'Consider: Inform project users about available issue types'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to assign issue type scheme to project');
      } catch (error: any) {
        let enhancedSuggestion = 'Ensure both the scheme and project exist';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = 'Scheme ID or Project ID not found';
          nextSteps = [
            '1. Use "get_issue_type_schemes" to find valid scheme IDs',
            '2. Use "search_projects" to find valid project IDs',
            '3. Retry with valid IDs from those discovery tools'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = 'Insufficient permissions to modify project configuration';
          nextSteps = [
            '1. Verify you have Jira System Administration permissions',
            '2. Or verify you have Project Administration permissions for this project',
            '3. Contact your Jira administrator for access'
          ];
        } else if (error.message?.includes('validation') || error.message?.includes('BAD_REQUEST')) {
          enhancedSuggestion = 'Invalid scheme or project configuration';
          nextSteps = [
            '1. Verify the scheme contains at least one issue type',
            '2. Check if the project has issues that require issue types not in the new scheme',
            '3. Consider using "add_issue_types_to_scheme" first'
          ];
        }

        logger.error('Failed to assign issue type scheme to project', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ASSIGN_ISSUE_TYPE_SCHEME_TO_PROJECT_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                related_tools: ['get_issue_type_schemes', 'search_projects', 'get_issue_type_scheme_mappings']
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // PHASE 5: Issue Createmeta Discovery Tools
  // =====================

  // Tool: getIssueCreatemetaIssuetypes
  server.registerTool(
    'get_issue_createmeta_issuetypes',
    {
      title: 'Get Issue Createmeta Issue Types',
      description: `🔍 DISCOVERY: Get available issue types that the current user can create in a specific project. Unlike "get_issue_types" which returns ALL issue types, this returns only those available for the specified project based on the project's issue type scheme and user permissions.

**Workflow:** Use this BEFORE "get_issue_createmeta_fields" to find valid issue type IDs for a project.`,
      inputSchema: getIssueCreatemetaIssuetypesInputSchema,
      annotations: {
        title: 'Get Issue Createmeta Issue Types',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getIssueCreatemetaIssuetypesSchema.parse(params);

        const queryParams: Record<string, any> = {
          startAt: validatedParams.startAt,
          maxResults: validatedParams.maxResults,
        };

        const response = await apiClient.makeRequest<{
          issueTypes: Array<{
            id: string;
            name: string;
            description?: string;
            subtask: boolean;
            iconUrl?: string;
            hierarchyLevel?: number;
          }>;
          startAt: number;
          maxResults: number;
          total: number;
        }>({
          method: 'GET',
          path: `/issue/createmeta/${validatedParams.projectIdOrKey}/issuetypes`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const { startAt, maxResults, total } = response.data;
          // API returns issueTypes array, not values
          const issueTypes = response.data.issueTypes || [];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                projectIdOrKey: validatedParams.projectIdOrKey,
                issueTypes: issueTypes.map(it => ({
                  id: it.id,
                  name: it.name,
                  description: it.description,
                  subtask: it.subtask,
                  hierarchyLevel: it.hierarchyLevel,
                })),
                pagination: { startAt: startAt || 0, maxResults: maxResults || 50, total: total || 0 },
                suggested_next_steps: issueTypes.length > 0 ? [
                  'Use "get_issue_createmeta_fields" with the issue type ID to see required fields and options',
                  'Use "create_issue" to create an issue with the discovered fields',
                ] : [
                  'Verify the project key is correct with "search_projects"',
                  'Check your permissions on this project',
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get createmeta issue types: No data returned');
      } catch (error: any) {
        logger.error('Failed to get createmeta issue types', { error: error.message });

        let suggestion = 'Verify the project exists and you have Browse Projects permission';
        if (error.message?.includes('not found') || error.statusCode === 404) {
          suggestion = 'Project not found. Verify the project key or ID with "search_projects"';
        } else if (error.message?.includes('permission') || error.statusCode === 403) {
          suggestion = 'You do not have permission to create issues in this project';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_CREATEMETA_ISSUETYPES_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion,
                related_tools: ['search_projects', 'get_issue_types'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getIssueCreatemetaFields
  server.registerTool(
    'get_issue_createmeta_fields',
    {
      title: 'Get Issue Createmeta Fields',
      description: `🔍 DISCOVERY: Get all fields (with options inline) for creating an issue in a specific project with a specific issue type. Returns only fields that appear on the create screen, with allowed values included directly.

**Replaces 3+ API calls** with a single call: no need to separately get fields, contexts, and options.

**Prerequisite:** Use "get_issue_createmeta_issuetypes" first to find valid issue type IDs for the project.

**Response includes:** Field ID, name, required flag, allowed values (for select/multi-select fields), and schema type.`,
      inputSchema: getIssueCreatemetaFieldsInputSchema,
      annotations: {
        title: 'Get Issue Createmeta Fields',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getIssueCreatemetaFieldsSchema.parse(params);

        const queryParams: Record<string, any> = {
          startAt: validatedParams.startAt,
          maxResults: validatedParams.maxResults,
        };

        const response = await apiClient.makeRequest<{
          fields: Array<{
            fieldId: string;
            required: boolean;
            name: string;
            key: string;
            operations: string[];
            allowedValues?: Array<Record<string, any>>;
            defaultValue?: any;
            schema: {
              type: string;
              system?: string;
              custom?: string;
              customId?: number;
              items?: string;
            };
          }>;
          startAt: number;
          maxResults: number;
          total: number;
        }>({
          method: 'GET',
          path: `/issue/createmeta/${validatedParams.projectIdOrKey}/issuetypes/${validatedParams.issueTypeId}`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const { startAt, maxResults, total } = response.data;
          // API returns fields array, not values
          const fields = response.data.fields || [];

          // Separate required vs optional fields for clarity
          const requiredFields = fields.filter(f => f.required);
          const optionalFields = fields.filter(f => !f.required);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                projectIdOrKey: validatedParams.projectIdOrKey,
                issueTypeId: validatedParams.issueTypeId,
                summary: {
                  totalFields: total,
                  requiredCount: requiredFields.length,
                  optionalCount: optionalFields.length,
                  fieldsWithOptions: fields.filter(f => f.allowedValues && f.allowedValues.length > 0).length,
                },
                requiredFields: requiredFields.map(f => ({
                  fieldId: f.fieldId,
                  name: f.name,
                  schema: f.schema,
                  operations: f.operations,
                  allowedValues: f.allowedValues,
                  defaultValue: f.defaultValue,
                })),
                optionalFields: optionalFields.map(f => ({
                  fieldId: f.fieldId,
                  name: f.name,
                  schema: f.schema,
                  operations: f.operations,
                  allowedValues: f.allowedValues,
                  defaultValue: f.defaultValue,
                })),
                pagination: { startAt, maxResults, total },
                suggested_next_steps: [
                  'Use "create_issue" with the discovered fields to create an issue',
                  'For custom fields, use the fieldId as the key in customFields parameter',
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get createmeta fields: No data returned');
      } catch (error: any) {
        logger.error('Failed to get createmeta fields', { error: error.message });

        let suggestion = 'Verify the project and issue type ID are correct';
        if (error.message?.includes('not found') || error.statusCode === 404) {
          suggestion = 'Project or issue type not found. Use "get_issue_createmeta_issuetypes" to find valid issue type IDs for this project';
        } else if (error.message?.includes('permission') || error.statusCode === 403) {
          suggestion = 'You do not have permission to create this issue type in this project';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_CREATEMETA_FIELDS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion,
                related_tools: ['get_issue_createmeta_issuetypes', 'search_projects'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
}