import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getAuditRecordsSchema,
  createFilterSchema,
  searchUsersSchema,
  searchGroupsSchema,
  getUserGroupsSchema,
  getApplicationRolesSchema,
  getBulkPermissionsSchema,
  getApplicationPropertiesSchema,
  setApplicationPropertySchema,
  getSystemAvatarsSchema,
  updateTimeTrackingSettingsSchema,
} from '../validation/schemas.js';
import {
  getAuditRecordsInputSchema,
  getInstanceInfoInputSchema,
  createFilterInputSchema,
  searchUsersInputSchema,
  searchGroupsInputSchema,
  getUserGroupsInputSchema,
  getApplicationRolesInputSchema,
  getBulkPermissionsInputSchema,
  getApplicationPropertiesInputSchema,
  setApplicationPropertyInputSchema,
  getSystemAvatarsInputSchema,
  getTimeTrackingSettingsInputSchema,
  updateTimeTrackingSettingsInputSchema,
} from '../validation/input-schemas.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';


export async function registerSystemTools(server: McpServer, apiClient: JiraApiClient) {
  // NOTE: search_jql removed - use jira-projects server for JQL searches (issue search is project-centric)

  // Tool: getAuditRecords
  server.registerTool(
    'get_audit_records',
    {
      title: 'Get Audit Records',
      description: '🔍 DISCOVERY TOOL: Primary audit log discovery method for administrative actions. Use this to find audit records with advanced filtering by date, action type, and user. Returns comprehensive audit data for security and compliance analysis.',
      inputSchema: getAuditRecordsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getAuditRecordsSchema.parse(params);

        const queryParams: any = {
          offset: validatedParams.offset,
          limit: validatedParams.limit,
        };

        if (validatedParams.filter) queryParams.filter = validatedParams.filter;
        if (validatedParams.from) queryParams.from = validatedParams.from;
        if (validatedParams.to) queryParams.to = validatedParams.to;

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/auditing/record',
          params: queryParams,
        });

        if (response.success && response.data) {
          const records = response.data.records || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                records,
                total: response.data.total,
                offset: response.data.offset,
                limit: response.data.limit,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve audit records');
      } catch (error: any) {
        logger.error('Failed to get audit records', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_AUDIT_RECORDS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have audit log viewing permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getInstanceInfo
  server.registerTool(
    'get_instance_info',
    {
      title: 'Get Instance Information',
      description: '🔍 DISCOVERY TOOL: Primary Jira instance information discovery method. Use this to find server details, version, deployment type, and basic system information needed for administration and integration operations.',
      inputSchema: getInstanceInfoInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async () => {
      try {
        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/serverInfo',
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                instanceInfo: response.data,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve instance information');
      } catch (error: any) {
        logger.error('Failed to get instance info', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_INSTANCE_INFO_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getSystemLimits
  server.registerTool(
    'get_system_limits',
    {
      title: 'Get System Limits',
      description: '📊 MONITORING: Retrieve system limits and current usage information for capacity planning and performance monitoring. Provides counts of projects, custom fields, workflows, and other system resources.',
      inputSchema: getInstanceInfoInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async () => {
      try {
        // Get various system limits
        const [
          projectsResponse,
          fieldsResponse,
          workflowsResponse,
        ] = await Promise.allSettled([
          apiClient.makeRequest<any>({ method: 'GET', path: '/project' }),
          apiClient.makeRequest<any>({ method: 'GET', path: '/field' }),
          apiClient.makeRequest<any>({ method: 'GET', path: '/workflows/search' }),
        ]);

        const limits = {
          projects: {
            count: projectsResponse.status === 'fulfilled' && projectsResponse.value.data 
              ? Array.isArray(projectsResponse.value.data) 
                ? projectsResponse.value.data.length 
                : projectsResponse.value.data.total || 0
              : 'unknown',
          },
          customFields: {
            count: fieldsResponse.status === 'fulfilled' && fieldsResponse.value.data
              ? fieldsResponse.value.data.filter((f: any) => f.isCustom).length
              : 'unknown',
          },
          workflows: {
            count: workflowsResponse.status === 'fulfilled' && workflowsResponse.value.data
              ? workflowsResponse.value.data.values?.length || 0
              : 'unknown',
          },
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              limits: limits,
              message: 'System usage information retrieved. Note: Actual limits depend on your Jira subscription plan.',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get system limits', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SYSTEM_LIMITS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createFilter
  server.registerTool(
    'create_filter',
    {
      title: 'Create Filter',
      description: '🆕 CREATE: Creates a new filter with JQL query and share permissions. After creation, use the returned filter ID with other filter management tools. Related tools: "search_jql" for testing JQL queries before filter creation.',
      inputSchema: createFilterInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createFilterSchema.parse(params);
        
        const filterData: any = {
          name: validatedParams.name,
          jql: validatedParams.jql,
        };

        if (validatedParams.description !== undefined) {
          filterData.description = validatedParams.description;
        }

        if (validatedParams.favourite !== undefined) {
          filterData.favourite = validatedParams.favourite;
        }

        if (validatedParams.sharePermissions && validatedParams.sharePermissions.length > 0) {
          filterData.sharePermissions = validatedParams.sharePermissions;
        }

        const response = await apiClient.makeRequest<any>({
          method: 'POST',
          path: '/filter',
          data: filterData,
        });

        if (response.success && response.data) {
          logger.info('Filter created successfully', { 
            filterId: response.data.id,
            filterName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                filter: response.data,
                message: `Filter '${response.data.name}' created successfully with ID ${response.data.id}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create filter');
      } catch (error: any) {
        logger.error('Failed to create filter', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_FILTER_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Check your JQL syntax and ensure you have filter creation permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: searchSiteUsers (renamed from search_users for clarity - this is site-level, not org-level)
  server.registerTool(
    'search_site_users',
    {
      title: 'Search Site Users',
      description: '🔍 DISCOVERY TOOL: Primary SITE-LEVEL user discovery method for finding users by name, email, username, or account ID. Use this first to find available user account IDs before using other user management tools. For org-level user search, use jira-organization server. Returns comprehensive list with account IDs, names, and key properties needed for subsequent user operations.',
      inputSchema: searchUsersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = searchUsersSchema.parse(params);

        const queryParams: any = {
          startAt: validatedParams.startAt,
          maxResults: validatedParams.maxResults,
        };

        if (validatedParams.query) queryParams.query = validatedParams.query;
        if (validatedParams.username) queryParams.username = validatedParams.username;
        if (validatedParams.accountId) queryParams.accountId = validatedParams.accountId;
        if (validatedParams.includeActive !== undefined) queryParams.includeActive = validatedParams.includeActive;
        if (validatedParams.includeInactive !== undefined) queryParams.includeInactive = validatedParams.includeInactive;

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/user/picker',
          params: queryParams,
        });

        if (response.success && response.data) {
          const users = response.data.users || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                users,
                total: response.data.total,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to search users');
      } catch (error: any) {
        logger.error('Failed to search users', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SEARCH_USERS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have user browsing permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: searchGroups
  server.registerTool(
    'search_groups',
    {
      title: 'Search Groups',
      description: '🔍 DISCOVERY TOOL: Primary group discovery method for finding groups by name or pattern. Use this first to find available group names before using other group management tools. Returns comprehensive list with group names and key properties needed for subsequent group operations.',
      inputSchema: searchGroupsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = searchGroupsSchema.parse(params);

        const queryParams: any = {
          maxResults: validatedParams.maxResults,
        };

        if (validatedParams.query) queryParams.query = validatedParams.query;
        if (validatedParams.exclude && validatedParams.exclude.length > 0) {
          queryParams.exclude = validatedParams.exclude.join(',');
        }

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/groups/picker',
          params: queryParams,
        });

        if (response.success && response.data) {
          const groups = response.data.groups || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                groups,
                total: response.data.total,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to search groups');
      } catch (error: any) {
        logger.error('Failed to search groups', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SEARCH_GROUPS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have group browsing permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getSiteUserGroups (renamed from get_user_groups for clarity - this is site-level, not org-level)
  server.registerTool(
    'get_site_user_groups',
    {
      title: 'Get Site User Groups',
      description: '⚠️ PREREQUISITE: Use "search_site_users" first to find valid user account IDs. Get all SITE-LEVEL groups that a specific user belongs to. For org-level user groups, use jira-organization server. If you get "User not found" errors, the user likely doesn\'t exist - use the discovery tool to find valid account IDs first.',
      inputSchema: getUserGroupsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getUserGroupsSchema.parse(params);

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: `/user/groups?accountId=${encodeURIComponent(validatedParams.accountId)}`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                groups: response.data,
                accountId: validatedParams.accountId,
                count: Array.isArray(response.data) ? response.data.length : 0,
                message: 'User groups retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get user groups');
      } catch (error: any) {
        logger.error('Failed to get user groups', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_USER_GROUPS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure the user exists and you have appropriate permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getApplicationRoles
  server.registerTool(
    'get_application_roles',
    {
      title: 'Get Application Roles',
      description: '🔍 DISCOVERY TOOL: Primary application role discovery method. Use this first to find available application role keys before using other role management tools. Returns comprehensive list with role keys, names, and properties needed for subsequent role operations.',
      inputSchema: getApplicationRolesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getApplicationRolesSchema.parse(params);

        let path = '/applicationrole';
        if (validatedParams.key) {
          path += `/${validatedParams.key}`;
        }

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: path,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                applicationRoles: response.data,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get application roles');
      } catch (error: any) {
        logger.error('Failed to get application roles', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_APPLICATION_ROLES_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have administrator permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getBulkPermissions
  server.registerTool(
    'get_bulk_permissions',
    {
      title: 'Get Bulk Permissions',
      description: '⚠️ PREREQUISITE: Use search_projects first to find valid project IDs. Check permissions across multiple projects efficiently. Uses the /permissions/check endpoint.',
      inputSchema: getBulkPermissionsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getBulkPermissionsSchema.parse(params);

        // Build the proper request format for /permissions/check
        // API requires numeric project IDs, not project keys
        const requestData = {
          projectPermissions: [{
            permissions: validatedParams.permissions,
            projects: validatedParams.projectIds.map(id => Number(id)),
          }],
        };

        const response = await apiClient.makeRequest<any>({
          method: 'POST',
          path: '/permissions/check',
          data: requestData,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                permissions: response.data.projectPermissions || response.data,
                projectIds: validatedParams.projectIds,
                checkedPermissions: validatedParams.permissions,
                message: 'Bulk permissions checked successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get bulk permissions');
      } catch (error: any) {
        logger.error('Failed to get bulk permissions', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_BULK_PERMISSIONS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure all projects exist and you have appropriate permissions. Valid permission keys include: BROWSE_PROJECTS, CREATE_ISSUES, EDIT_ISSUES, ADMINISTER_PROJECTS.',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getApplicationProperties
  server.registerTool(
    'get_application_properties',
    {
      title: 'Get Application Properties',
      description: '🔍 DISCOVERY TOOL: Primary system configuration discovery method. Use this first to find available application property keys and current settings before using property management tools. Returns comprehensive list with property IDs, keys, and values needed for subsequent configuration operations.',
      inputSchema: getApplicationPropertiesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getApplicationPropertiesSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.key) queryParams.key = validatedParams.key;
        if (validatedParams.keyFilter) queryParams.keyFilter = validatedParams.keyFilter;

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/application-properties',
          params: queryParams,
        });

        if (response.success && response.data) {
          const properties = Array.isArray(response.data) ? response.data : [response.data];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                properties: response.data,
                count: properties.length,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get application properties');
      } catch (error: any) {
        logger.error('Failed to get application properties', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_APPLICATION_PROPERTIES_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have system administrator permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: setApplicationProperty
  server.registerTool(
    'set_application_property',
    {
      title: 'Set Application Property',
      description: '⚠️ PREREQUISITE: Use "get_application_properties" first to find valid property IDs. Set or update a Jira application property configuration. If you get "Property not found" errors, the property likely doesn\'t exist - use the discovery tool to find valid property IDs first.',
      inputSchema: setApplicationPropertyInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = setApplicationPropertySchema.parse(params);

        const response = await apiClient.makeRequest<any>({
          method: 'PUT',
          path: `/application-properties/${encodeURIComponent(validatedParams.id)}`,
          data: {
            id: validatedParams.id,
            value: validatedParams.value,
          },
        });

        if (response.success) {
          logger.info('Application property updated successfully', { 
            propertyId: validatedParams.id,
            value: validatedParams.value 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                property: {
                  id: validatedParams.id,
                  value: validatedParams.value,
                },
                message: `Application property '${validatedParams.id}' updated successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to set application property');
      } catch (error: any) {
        logger.error('Failed to set application property', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SET_APPLICATION_PROPERTY_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have system administrator permissions and the property exists',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getSystemAvatars
  server.registerTool(
    'get_system_avatars',
    {
      title: 'Get System Avatars',
      description: '🔍 DISCOVERY TOOL: Primary avatar discovery method for projects, issue types, or users. Use this first to find available avatar IDs and URLs before using avatar management tools. Returns comprehensive list with avatar IDs and metadata needed for subsequent avatar operations.',
      inputSchema: getSystemAvatarsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getSystemAvatarsSchema.parse(params);
        const avatarType = validatedParams.type;

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: `/avatar/${avatarType}/system`,
        });

        if (response.success && response.data) {
          const avatars = response.data.system || response.data;
          const avatarArray = Array.isArray(avatars) ? avatars : [avatars];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                avatars,
                type: avatarType,
                count: avatarArray.length,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get system avatars');
      } catch (error: any) {
        logger.error('Failed to get system avatars', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SYSTEM_AVATARS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have appropriate permissions to view avatars',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getTimeTrackingSettings
  server.registerTool(
    'get_time_tracking_settings',
    {
      title: 'Get Time Tracking Settings',
      description: '🔍 DISCOVERY TOOL: Primary time tracking configuration discovery method. Use this first to review current time tracking settings before making configuration changes. Returns working hours, time formats, and default units.',
      inputSchema: getTimeTrackingSettingsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async () => {
      try {
        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/configuration/timetracking',
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                timeTrackingSettings: response.data,
                message: 'Time tracking settings retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get time tracking settings');
      } catch (error: any) {
        logger.error('Failed to get time tracking settings', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_TIME_TRACKING_SETTINGS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have system administrator permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateTimeTrackingSettings
  server.registerTool(
    'update_time_tracking_settings',
    {
      title: 'Update Time Tracking Settings',
      description: '⚠️ KNOWN LIMITATION: Time tracking settings in Jira Cloud are managed differently than Jira Data Center. Use "get_time_tracking_settings" to view current provider. Settings like working hours/days may need to be configured via Jira UI (Administration > System > Time Tracking).',
      inputSchema: updateTimeTrackingSettingsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateTimeTrackingSettingsSchema.parse(params);

        // Jira Cloud time tracking configuration is limited via REST API
        // The /configuration/timetracking endpoint returns provider info
        // Working hours/days settings are typically UI-only in Cloud
        const response = await apiClient.makeRequest<any>({
          method: 'PUT',
          path: '/configuration/timetracking/options',
          data: {
            workingHoursPerDay: validatedParams.workingHoursPerDay,
            workingDaysPerWeek: validatedParams.workingDaysPerWeek,
            timeFormat: validatedParams.timeFormat,
            defaultUnit: validatedParams.defaultUnit,
          },
        });

        if (response.success && response.data) {
          logger.info('Time tracking settings updated successfully', validatedParams);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                timeTrackingSettings: response.data,
                message: 'Time tracking settings updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update time tracking settings');
      } catch (error: any) {
        logger.error('Failed to update time tracking settings', { error: error.message });

        // Provide helpful error message for Cloud limitation
        const isCloudLimitation = error.message?.includes('400') ||
          error.message?.includes('validation') ||
          error.message?.includes('VALIDATION_ERROR');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_TIME_TRACKING_SETTINGS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: isCloudLimitation
                  ? 'Time tracking settings in Jira Cloud may be read-only via REST API. Configure these settings via Jira Administration UI: Administration > System > Time Tracking.'
                  : (error.suggestion || 'Ensure you have system administrator permissions'),
                knownLimitation: isCloudLimitation
                  ? 'Jira Cloud REST API has limited support for time tracking configuration. Use Jira UI for working hours, days per week, and time format settings.'
                  : undefined,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: get_jira_license - Requires Organization Admin permissions with billing/license scopes
  // Standard API tokens cannot access license information. See backlog.json for details.
  /*
  server.registerTool(
    'get_jira_license',
    {
      title: 'Get Jira License',
      description: '🔍 DISCOVERY TOOL: Primary license information discovery method for compliance and capacity planning. Returns license details, user counts, and subscription information. Note: Requires Organization Admin permissions for full license details.',
      inputSchema: getJiraLicenseInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async () => {
      try {
        // Try the license endpoint first
        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/instance/license',
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                license: response.data,
                source: 'license_endpoint',
                message: 'Jira license information retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get Jira license information');
      } catch (licenseError: any) {
        logger.error('License endpoint failed, trying fallback', { error: licenseError.message });
        
        // Fallback to serverInfo and user count
        try {
          const [serverInfoResponse, userCountResponse] = await Promise.all([
            apiClient.makeRequest<any>({ method: 'GET', path: '/serverInfo' }),
            apiClient.makeRequest<any>({ method: 'GET', path: '/user/picker?maxResults=1' }),
          ]);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                license: {
                  version: serverInfoResponse.data?.version,
                  deploymentType: serverInfoResponse.data?.deploymentType,
                  serverTitle: serverInfoResponse.data?.serverTitle,
                  buildNumber: serverInfoResponse.data?.buildNumber,
                  userCount: userCountResponse.data?.total || 'Unknown',
                },
                source: 'serverinfo_fallback',
                warning: 'License endpoint requires Organization Admin permissions. Using serverInfo fallback.',
                authenticationIssue: {
                  failedEndpoint: '/instance/license',
                  error: licenseError.code || 'AUTH_ERROR',
                  requiredPermissions: 'Organization Admin API token with enhanced scopes (read:billing:admin, read:organization:admin)',
                  currentAuth: 'Site-level API token (basic auth)',
                  solution: 'Create organization-level API token at https://id.atlassian.com/manage-profile/security/api-tokens with enhanced scopes',
                },
                message: 'License information retrieved using fallback method',
              }, null, 2),
            }],
          };
        } catch (fallbackError: any) {
          logger.error('Both license and fallback failed', { 
            licenseError: licenseError.message,
            fallbackError: fallbackError.message,
          });
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'GET_JIRA_LICENSE_ERROR',
                  message: 'Unable to retrieve license information',
                  primaryError: {
                    endpoint: '/instance/license',
                    error: licenseError.message,
                    code: licenseError.code,
                    authenticationRequired: 'Organization Admin permissions with enhanced API token scopes',
                  },
                  fallbackError: {
                    endpoint: '/serverInfo',
                    error: fallbackError.message,
                    code: fallbackError.code,
                  },
                  suggestion: 'Create an Organization Admin API token with billing/license scopes at https://id.atlassian.com/manage-profile/security/api-tokens',
                  details: 'The /instance/license endpoint requires different authentication than regular Jira API calls',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }
      }
    }
  );
  */

  // REMOVED: get_system_webhooks - Requires OAuth 2.0 (3LO) or Connect app authentication
  // Standard API tokens cannot access webhooks. See backlog.json for details.
  /*
  server.registerTool(
    'get_system_webhooks',
    {
      title: 'Get System Webhooks',
      description: '⚠️ KNOWN LIMITATION: Webhook API requires OAuth 2.0 (3LO) authentication or Connect app. Standard API tokens may not have access. Returns list of webhooks registered by your authenticated app.',
      inputSchema: getSystemWebhooksInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getSystemWebhooksSchema.parse(params);

        const queryParams = {
          startAt: validatedParams.startAt,
          maxResults: validatedParams.maxResults,
        };

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/webhook',
          params: queryParams,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                webhooks: response.data.values || response.data,
                pagination: {
                  startAt: response.data.startAt,
                  maxResults: response.data.maxResults,
                  total: response.data.total,
                  isLast: response.data.isLast,
                },
                message: 'System webhooks retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get system webhooks');
      } catch (error: any) {
        logger.error('Failed to get system webhooks', { error: error.message });

        // Check for permission-related errors
        const isPermissionError = error.message?.includes('403') ||
          error.message?.includes('permission') ||
          error.message?.includes('PERMISSION_DENIED') ||
          error.message?.includes('unauthorized');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SYSTEM_WEBHOOKS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: isPermissionError
                  ? 'The webhook API requires OAuth 2.0 (3LO) authentication or Connect app permissions. Standard API tokens cannot access webhooks.'
                  : (error.suggestion || 'Ensure you have system administrator permissions'),
                knownLimitation: isPermissionError
                  ? 'Jira Cloud webhook API is only accessible via OAuth 2.0 or Connect apps, not basic API tokens. Webhooks can be managed via Jira UI: Administration > System > Webhooks.'
                  : undefined,
                alternativeApproach: isPermissionError
                  ? 'View and manage webhooks through Jira Administration UI, or use a Connect app with proper scopes.'
                  : undefined,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // NOTE: Organization-level tools (get_org_*) moved to jira-organization server
  // The following tools are now available on jira-organization:
  // - get_org_api_tokens, get_org_api_tokens_count
  // - get_org_api_keys, get_org_api_keys_count
  // - get_org_audit_events, get_org_audit_events_stream
  // - get_org_security_policies, get_org_security_policy
  // - get_org_auth_policies
  // - get_org_classification_levels, get_org_classification_level

  // System tools registered successfully (logging disabled for MCP compatibility)
}
