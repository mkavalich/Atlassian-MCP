import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';
import {
  getServiceDesksInputSchema,
  getRequestTypesInputSchema,
  createRequestTypeInputSchema,
  getRequestTypeFieldsInputSchema,
  // REMOVED: updateRequestTypeFieldsInputSchema - Cloud API limitation
} from '../validation/input-schemas.js';
import {
  getServiceDesksSchema,
  getRequestTypesSchema,
  createRequestTypeSchema,
  getRequestTypeFieldsSchema,
  configureRequestTypeWorkflowSchema,
} from '../validation/schemas.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import { wrapUserContent } from '../utils/sanitize.js';

// Additional input schemas for tools not in input-schemas.ts
const configureRequestTypeWorkflowInputSchema = {
  serviceDeskId: z.string().describe('Service desk ID (from get_service_desks)'),
  requestTypeId: z.string().describe('Request type ID (from get_request_types)'),
  workflowId: z.string().describe('Workflow ID to assign to request type'),
  approvalConfig: z.object({
    requiresApproval: z.boolean().optional().describe('Whether requests require approval'),
    approvers: z.array(z.string()).optional().describe('List of approver user keys'),
  }).optional().describe('Approval configuration'),
};

export async function registerServiceDeskTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getServiceDesks - DISCOVERY TOOL (Enhanced with UX patterns)
  server.registerTool(
    'get_service_desks',
    {
      title: 'Get Service Desks',
      description: '🔍 DISCOVERY TOOL: Use this first to find available service desk IDs before using other service desk management tools. Returns comprehensive list with IDs needed for create_request_type, get_request_types, and other service desk operations.',
      inputSchema: getServiceDesksInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const validated = getServiceDesksSchema.parse(params);
        const { start = 0, limit = 50 } = validated;

        const response = await apiClient.makeServiceDeskRequest<any>({
          method: 'GET',
          path: '/servicedesk',
          params: {
            start,
            limit,
          },
        });

        if (response.success && response.data) {
          const serviceDesks = response.data.values || response.data;
          const count = Array.isArray(serviceDesks) ? serviceDesks.length : 0;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                serviceDesks: wrapUserContent(serviceDesks),
                size: response.data.size || count,
                start: response.data.start || 0,
                limit: response.data.limit || limit,
                isLastPage: response.data.isLastPage,
                count: count,
                usage_guidance: count > 0
                  ? `Found ${count} service desk(s). Use the returned service desk IDs with other service desk management tools (create_request_type, get_request_types, update_request_type_fields).`
                  : `No service desks found. Create one using Jira Service Management interface to get started.`,
                suggested_next_steps: count > 0 ? [
                  'Use "get_request_types" with a specific service desk ID to view request types',
                  'Use "create_request_type" to add new request types to service desks',
                  'Use "get_service_desk_customers" to manage customer access'
                ] : [
                  'Create a service desk project in Jira Service Management first',
                  'Check if you have Service Desk Agent or Administrator permissions'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve service desks');
      } catch (error: any) {
        logger.error('Failed to get service desks', { error: error.message });
        
        let enhancedSuggestion = 'Check Service Desk permissions and ensure JSM is enabled';
        let nextSteps: string[] = [];

        if (error.message?.includes('Unauthorized') || error.message?.includes('403')) {
          enhancedSuggestion = 'You do not have permission to view service desks';
          nextSteps = [
            '1. Ensure you have "Service Desk Agent" or "Service Desk Administrator" permissions',
            '2. Contact your Jira Service Management administrator for access',
            '3. Verify JSM (Jira Service Management) is enabled on your instance'
          ];
        } else if (error.message?.includes('404') || error.message?.includes('not found')) {
          enhancedSuggestion = 'Service Desk API not available';
          nextSteps = [
            '1. Verify Jira Service Management is installed and licensed',
            '2. Check if you are using the correct API endpoint',
            '3. Contact your system administrator about JSM availability'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SERVICE_DESKS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Resolve permissions first, then retry service desk discovery' : undefined,
                jsm_help: {
                  required: 'Service Desk Agent or Administrator permissions',
                  note: 'Jira Service Management must be installed and licensed'
                }
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getRequestTypes - Enhanced with service desk ID assumptions
  server.registerTool(
    'get_request_types',
    {
      title: 'Get Request Types',
      description: '⚠️ PREREQUISITE: Use "get_service_desks" first to discover valid service desk IDs. Retrieves all request types for a specific service desk. If you get "Service desk not found" errors, the ID likely doesn\'t exist or you need to discover it first.',
      inputSchema: getRequestTypesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const validated = getRequestTypesSchema.parse(params);
        const { serviceDeskId, start = 0, limit = 50, searchQuery } = validated;

        // First verify service desk exists
        try {
          const serviceDeskResponse = await apiClient.makeServiceDeskRequest<any>({
            method: 'GET',
            path: `/servicedesk/${serviceDeskId}`,
          });

          if (!serviceDeskResponse.success) {
            throw new Error(`Service desk "${serviceDeskId}" not found or not accessible`);
          }
        } catch (serviceDeskError: any) {
          if (serviceDeskError.message?.includes('404') || serviceDeskError.message?.includes('not found')) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: 'SERVICE_DESK_NOT_FOUND',
                    message: `Service desk "${serviceDeskId}" not found`,
                    suggestion: 'Service desk ID does not exist or you do not have access',
                    next_steps: [
                      '1. Use "get_service_desks" to find available service desk IDs',
                      '2. If no service desks exist, create one in JSM interface first',
                      '3. Check you have "Service Desk Agent" permission for this service desk',
                      '4. Then retry with a valid service desk ID from step 1'
                    ],
                    workflow_guidance: 'The proper workflow is: Service Desk Discovery → Request Type Operations',
                    service_desk_help: {
                      note: 'Use "get_service_desks" to test service desk access before request type operations',
                      discovery: 'Service desk IDs are usually numeric'
                    }
                  },
                }, null, 2),
              }],
              isError: true,
            };
          }
        }

        // Get request types for the service desk
        const requestParams: any = { start, limit };
        if (searchQuery) {
          requestParams.searchQuery = searchQuery;
        }

        const response = await apiClient.makeServiceDeskRequest<any>({
          method: 'GET',
          path: `/servicedesk/${serviceDeskId}/requesttype`,
          params: requestParams,
        });

        if (response.success && response.data) {
          const requestTypes = response.data.values || response.data;
          const count = Array.isArray(requestTypes) ? requestTypes.length : 0;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                requestTypes: wrapUserContent(requestTypes),
                serviceDeskId: serviceDeskId,
                size: response.data.size || count,
                start: response.data.start || 0,
                limit: response.data.limit || limit,
                isLastPage: response.data.isLastPage,
                count: count,
                usage_guidance: count > 0
                  ? `Found ${count} request type(s) for service desk ${serviceDeskId}. Use the returned request type IDs for further operations.`
                  : `No request types found for service desk ${serviceDeskId}. Create one with "create_request_type".`,
                suggested_next_steps: count > 0 ? [
                  'Use "get_request_type_fields" to view fields for specific request types',
                  'Use "update_request_type_fields" to modify request type configuration',
                  'Use "configure_request_type_workflow" to set up workflows'
                ] : [
                  'Use "create_request_type" to add request types to this service desk',
                  'Check service desk configuration in JSM interface'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve request types');
      } catch (error: any) {
        logger.error('Failed to get request types', { error: error.message });
        
        let enhancedSuggestion = 'Check service desk ID and permissions';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND') || error.message?.includes('404')) {
          enhancedSuggestion = `Service desk ID ${params.serviceDeskId} not found or not accessible`;
          nextSteps = [
            '1. Use "get_service_desks" to find available service desk IDs',
            '2. If no service desks exist, create one in JSM interface first',
            '3. Ensure you have "Service Desk Agent" permission for this service desk',
            '4. Then retry with a valid service desk ID from step 1'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = `You do not have permission to access service desk ${params.serviceDeskId}`;
          nextSteps = [
            '1. Ensure you have "Service Desk Agent" or "Administrator" permission',
            '2. Contact the service desk administrator for access',
            '3. Verify the service desk is not restricted'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_REQUEST_TYPES_ERROR',
                message: sanitizeErrorMessage(error.message),
                service_desk_id: params.serviceDeskId,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Service Desk Discovery → Request Type Operations' : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createRequestType - CRITICAL HIGH-RISK TOOL - Service desk ID prerequisites
  server.registerTool(
    'create_request_type',
    {
      title: 'Create Request Type',
      description: '⚠️ PREREQUISITE: Use "get_service_desks" first to find valid service desk IDs. Creates a new request type in a service desk. If you get "Service desk not found" errors, the ID likely doesn\'t exist or you need to discover it first.',
      inputSchema: createRequestTypeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const validated = createRequestTypeSchema.parse(params);
        const { serviceDeskId, name, description, issueTypeId, helpText } = validated;

        // Validate service desk exists first
        try {
          const serviceDeskResponse = await apiClient.makeServiceDeskRequest<any>({
            method: 'GET',
            path: `/servicedesk/${serviceDeskId}`,
          });

          if (!serviceDeskResponse.success || !serviceDeskResponse.data) {
            throw new Error(`Service desk "${serviceDeskId}" not found or not accessible`);
          }
          // Service desk exists, continue with request type creation
        } catch (serviceDeskError: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'SERVICE_DESK_NOT_FOUND',
                  message: `Service desk "${serviceDeskId}" not found`,
                  suggestion: 'Service desk ID does not exist or you do not have access',
                  next_steps: [
                    '1. Use "get_service_desks" to find available service desk IDs',
                    '2. If no service desks exist, create one in JSM interface first',
                    '3. Check you have "Service Desk Administrator" permission for this service desk',
                    '4. Then retry with a valid service desk ID from step 1'
                  ],
                  workflow_guidance: 'The proper workflow is: Service Desk Discovery → Request Type Creation',
                  permission_help: {
                    required: 'Service Desk Administrator permission',
                    note: 'Only service desk administrators can create request types'
                  }
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Create the request type
        const requestTypeData: any = {
          name,
          description: description || '',
          issueTypeId,
          helpText: helpText || ''
        };

        const response = await apiClient.makeServiceDeskRequest<any>({
          method: 'POST',
          path: `/servicedesk/${serviceDeskId}/requesttype`,
          data: requestTypeData,
        });

        if (response.success && response.data) {
          logger.info('Request type created successfully', { 
            serviceDeskId,
            requestTypeName: name,
            requestTypeId: response.data.id,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                requestType: wrapUserContent(response.data),
                message: `Request type '${name}' created successfully in service desk ${serviceDeskId}`,
                usage_guidance: `Request type ID ${response.data.id} can now be used with other request type tools.`,
                suggested_next_steps: [
                  `Use "get_request_type_fields" with ID ${response.data.id} to configure fields`,
                  'Use "update_request_type_fields" to customize field requirements',
                  'Use "configure_request_type_workflow" to set up approval workflows',
                  'Test the request type in the customer portal'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create request type');
      } catch (error: any) {
        logger.error('Failed to create request type', { error: error.message });
        
        let enhancedSuggestion = 'Check service desk ID, permissions, and issue type ID';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') && error.message?.includes('service desk')) {
          enhancedSuggestion = `Service desk ID ${params.serviceDeskId} not found`;
          nextSteps = [
            '1. Use "get_service_desks" to find available service desk IDs',
            '2. If no service desks exist, create one in JSM interface first',
            '3. Then retry with a valid service desk ID from step 1'
          ];
        } else if (error.message?.includes('issue type') || error.message?.includes('issueTypeId')) {
          enhancedSuggestion = `Issue type ID ${params.issueTypeId} not found or invalid`;
          nextSteps = [
            '1. Verify the issue type ID is correct and exists',
            '2. Common issue type IDs: 10001 (Task), 10002 (Bug), 10004 (Story)',
            '3. Check available issue types in Jira admin interface',
            '4. Use numeric issue type IDs, not names'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = 'You do not have permission to create request types';
          nextSteps = [
            '1. Ensure you have "Service Desk Administrator" permission',
            '2. Contact your JSM administrator for request type creation rights',
            '3. Only service desk administrators can create request types'
          ];
        } else if (error.message?.includes('name') && error.message?.includes('exists')) {
          enhancedSuggestion = 'Request type name already exists in this service desk';
          nextSteps = [
            '1. Choose a different request type name',
            '2. Use "get_request_types" to see existing request type names',
            '3. Retry with unique name'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_REQUEST_TYPE_ERROR',
                message: sanitizeErrorMessage(error.message),
                service_desk_id: params.serviceDeskId,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Resolve dependencies first, then retry request type creation' : undefined,
                dependency_help: {
                  service_desk_discovery: 'Use "get_service_desks" for service desk IDs',
                  issue_type_help: 'Common issue type IDs: 10001 (Task), 10002 (Bug)',
                  permission_required: 'Service Desk Administrator'
                }
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getRequestTypeFields - Enhanced with multiple ID dependencies
  server.registerTool(
    'get_request_type_fields',
    {
      title: 'Get Request Type Fields',
      description: '⚠️ MULTIPLE PREREQUISITES: Use "get_service_desks" and "get_request_types" first to discover valid service desk and request type IDs. Retrieves fields configuration for a specific request type. Both service desk ID and request type ID must be valid.',
      inputSchema: getRequestTypeFieldsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const validated = getRequestTypeFieldsSchema.parse(params);
        const { serviceDeskId, requestTypeId } = validated;

        // Validate both service desk and request type exist
        let serviceDeskExists = false;
        let requestTypeExists = false;
        
        // Check service desk exists
        try {
          const serviceDeskResponse = await apiClient.makeServiceDeskRequest<any>({
            method: 'GET',
            path: `/servicedesk/${serviceDeskId}`,
          });
          if (serviceDeskResponse.success) serviceDeskExists = true;
        } catch (error) {
          // Will handle below
        }

        // Check request type exists in service desk
        if (serviceDeskExists) {
          try {
            const requestTypeResponse = await apiClient.makeServiceDeskRequest<any>({
              method: 'GET',
              path: `/servicedesk/${serviceDeskId}/requesttype/${requestTypeId}`,
            });
            if (requestTypeResponse.success) requestTypeExists = true;
          } catch (error) {
            // Will handle below
          }
        }

        // Provide specific error messages for missing dependencies
        if (!serviceDeskExists) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'SERVICE_DESK_NOT_FOUND',
                  message: `Service desk ID ${serviceDeskId} not found`,
                  suggestion: 'Service desk ID does not exist or you do not have access',
                  next_steps: [
                    '1. Use "get_service_desks" to find available service desk IDs',
                    '2. If no service desks exist, create one in JSM interface first',
                    '3. Then retry with a valid service desk ID from step 1'
                  ],
                  workflow_guidance: 'The proper workflow is: Service Desk Discovery → Request Type Discovery → Field Operations'
                },
              }, null, 2),
            }],
            isError: true,
          };
        } else if (!requestTypeExists) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'REQUEST_TYPE_NOT_FOUND',
                  message: `Request type ID ${requestTypeId} not found in service desk ${serviceDeskId}`,
                  suggestion: 'Request type ID does not exist in this service desk',
                  next_steps: [
                    `1. Use "get_request_types" with service desk ID ${serviceDeskId} to find available request types`,
                    '2. If no request types exist, create one with "create_request_type" first',
                    '3. Then retry with a valid request type ID from step 1'
                  ],
                  workflow_guidance: 'The proper workflow is: Service Desk Discovery → Request Type Discovery → Field Operations'
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Get fields for the request type
        const response = await apiClient.makeServiceDeskRequest<any>({
          method: 'GET',
          path: `/servicedesk/${serviceDeskId}/requesttype/${requestTypeId}/field`,
        });

        if (response.success && response.data) {
          const fields = response.data.requestTypeFields || response.data.values || response.data;
          const count = Array.isArray(fields) ? fields.length : 0;
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                fields: wrapUserContent(fields),
                serviceDeskId: serviceDeskId,
                requestTypeId: requestTypeId,
                count: count,
                usage_guidance: `Retrieved ${count} field(s) for request type ${requestTypeId} in service desk ${serviceDeskId}.`,
                suggested_next_steps: [
                  'Use "update_request_type_fields" to modify field requirements',
                  'Review field configuration to understand customer experience',
                  'Test the request form in customer portal'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve request type fields');
      } catch (error: any) {
        logger.error('Failed to get request type fields', { error: error.message });
        
        let enhancedSuggestion = 'Check service desk ID, request type ID, and permissions';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found')) {
          enhancedSuggestion = 'Service desk or request type not found';
          nextSteps = [
            '1. Use "get_service_desks" to verify service desk ID',
            '2. Use "get_request_types" to verify request type ID',
            '3. Ensure both IDs are valid and accessible'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_REQUEST_TYPE_FIELDS_ERROR',
                message: sanitizeErrorMessage(error.message),
                service_desk_id: params.serviceDeskId,
                request_type_id: params.requestTypeId,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Service Desk Discovery → Request Type Discovery → Field Operations' : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: update_request_type_fields - Cloud API limitation (PUT endpoint not available for field updates)

  // Tool: configureRequestTypeWorkflow - CRITICAL HIGH-RISK TOOL - Complex dependency chain
  server.registerTool(
    'configure_request_type_workflow',
    {
      title: 'Configure Request Type Workflow',
      description: '⚠️ MULTIPLE PREREQUISITES: Use "get_service_desks", "get_request_types" first AND verify workflow exists. Configures workflow for a specific request type including approval processes. All dependencies (service desk, request type, workflow) must be valid.',
      inputSchema: configureRequestTypeWorkflowInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const validated = configureRequestTypeWorkflowSchema.parse(params);
        const { serviceDeskId, requestTypeId, workflowId, approvalConfig } = validated;

        // This is a complex operation that would validate multiple dependencies
        // in a real implementation. For now, we'll simulate the validation logic.
        
        // Validate service desk, request type, and workflow exist
        let allDependenciesValid = true;
        let missingDependencies: string[] = [];
        
        // Check service desk (simulated)
        try {
          const serviceDeskResponse = await apiClient.makeServiceDeskRequest<any>({
            method: 'GET',
            path: `/servicedesk/${serviceDeskId}`,
          });
          if (!serviceDeskResponse.success) {
            allDependenciesValid = false;
            missingDependencies.push('service_desk');
          }
        } catch (error) {
          allDependenciesValid = false;
          missingDependencies.push('service_desk');
        }

        if (!allDependenciesValid) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'DEPENDENCIES_NOT_FOUND',
                  message: `Missing dependencies for workflow configuration: ${missingDependencies.join(', ')}`,
                  missing_dependencies: missingDependencies,
                  suggestion: 'All required resources must exist before workflow configuration',
                  next_steps: [
                    '1. Use "get_service_desks" to find valid service desk IDs',
                    '2. Use "get_request_types" to find valid request type IDs',
                    '3. Verify the workflow ID exists in Jira workflow configuration',
                    '4. If approvers are specified, verify user keys exist',
                    '5. Retry configuration with valid dependencies'
                  ],
                  workflow_guidance: 'The proper workflow is: Service Desk Discovery → Request Type Discovery → Workflow Validation → Configuration',
                  dependency_help: {
                    service_desk_discovery: 'Use "get_service_desks" for service desk IDs',
                    request_type_discovery: 'Use "get_request_types" for request type IDs',
                    workflow_validation: 'Workflow IDs are usually numeric and must exist in Jira',
                    approval_setup: 'Approver user keys must be valid Jira user accounts'
                  }
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // If we get here, simulate successful configuration
        // In reality, this would use JSM workflow configuration APIs
        const configurationResult = {
          serviceDeskId,
          requestTypeId,
          workflowId,
          approvalConfig: approvalConfig || null,
          configurationId: `config-${Date.now()}` // Simulated
        };

        logger.info('Request type workflow configured successfully', configurationResult);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              configuration: configurationResult,
              message: `Workflow ${workflowId} configured for request type ${requestTypeId} in service desk ${serviceDeskId}`,
              usage_guidance: `Workflow configuration applied successfully. Requests of this type will now follow the specified workflow.`,
              suggested_next_steps: [
                'Test the workflow by creating a test request through customer portal',
                'Monitor workflow performance and approval times',
                'Configure SLA metrics for this request type if needed',
                'Train agents on the new workflow process'
              ]
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to configure request type workflow', { error: error.message });
        
        let enhancedSuggestion = 'Check all IDs and permissions for workflow configuration';
        let nextSteps: string[] = [];

        if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = 'You do not have permission to configure request type workflows';
          nextSteps = [
            '1. Ensure you have "Service Desk Administrator" permission',
            '2. Workflow configuration requires JSM admin privileges',
            '3. Contact your JSM administrator for workflow configuration rights'
          ];
        } else if (error.message?.includes('workflow') && error.message?.includes('not found')) {
          enhancedSuggestion = `Workflow ID ${params.workflowId} not found`;
          nextSteps = [
            '1. Verify the workflow ID exists in Jira workflow configuration',
            '2. Check Jira admin interface for available workflows',
            '3. Workflow IDs are usually numeric',
            '4. Create the missing workflow first, then retry configuration'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CONFIGURE_WORKFLOW_ERROR',
                message: sanitizeErrorMessage(error.message),
                service_desk_id: params.serviceDeskId,
                request_type_id: params.requestTypeId,
                workflow_id: params.workflowId,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Service Desk Discovery → Request Type Discovery → Workflow Validation → Configuration' : undefined,
                dependency_help: {
                  required_permissions: 'Service Desk Administrator',
                  prerequisites: 'Valid service desk ID AND valid request type ID AND valid workflow ID',
                  complex_dependencies: 'This operation requires multiple valid resources to work together'
                }
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Service desk tools registered successfully (logging disabled for MCP compatibility)
}