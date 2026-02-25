import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConfluenceApiClient } from '../api/client.js';
import {
  getTemplatesSchema,
  getTemplateSchema,
  createTemplateSchema,
  updateTemplateSchema,
  deleteTemplateSchema,
  getLabelsSchema,
  addLabelsSchema,
  removeLabelSchema,
  getSpaceLabelsSchema,
  addSpaceLabelSchema,
  removeSpaceLabelSchema,
  searchCqlSchema,
  searchContentSchema,
} from '../validation/schemas.js';
import {
  getTemplatesInputSchema,
  getTemplateInputSchema,
  createTemplateInputSchema,
  updateTemplateInputSchema,
  deleteTemplateInputSchema,
  getLabelsInputSchema,
  addLabelsInputSchema,
  removeLabelInputSchema,
  getSpaceLabelsInputSchema,
  addSpaceLabelInputSchema,
  removeSpaceLabelInputSchema,
  searchCqlInputSchema,
  searchContentInputSchema,
} from '../validation/input-schemas.js';
import {
  ConfluenceTemplate,
  ConfluenceLabel,
  SearchResponse,
  PaginatedResponse,
  CursorPaginatedResponse,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { toolExamples } from '../validation/tool-examples.js';

export async function registerContentTools(server: McpServer, apiClient: ConfluenceApiClient) {
  // =====================
  // Template Operations
  // =====================

  // Tool: get_templates
  server.registerTool(
    'get_templates',
    {
      title: 'Get Templates',
      description: '🔍 DISCOVERY: Get available page templates. Filter by space for space-specific templates, or omit for global templates.',
      inputSchema: getTemplatesInputSchema,
      annotations: {
        title: 'Get Templates',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getTemplatesSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.spaceKey) {
          queryParams.spaceKey = validatedParams.spaceKey;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.start = validatedParams.cursor;
        }

        // V1 API for templates
        const response = await apiClient.makeV1Request<PaginatedResponse<ConfluenceTemplate>>({
          method: 'GET',
          path: '/template/page',
          params: queryParams,
        });

        if (response.success && response.data) {
          const templates = response.data.results;

          const templatesData = templates.map(t => ({
            templateId: t.templateId,
            name: t.name,
            description: t.description,
            templateType: t.templateType,
            spaceKey: t.space?.key,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                templates: templatesData,
                pagination: {
                  returned: templates.length,
                  hasMore: !!response.data._links?.next,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get templates');
      } catch (error: any) {
        logger.error('Failed to get templates', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_TEMPLATES_ERROR',
                message: error.message,
                suggestion: 'Check your search parameters',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_template
  server.registerTool(
    'get_template',
    {
      title: 'Get Template',
      description: '📖 READ: Get details and body content of a specific template.',
      inputSchema: getTemplateInputSchema,
      annotations: {
        title: 'Get Template',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getTemplateSchema.parse(params);

        const response = await apiClient.makeV1Request<ConfluenceTemplate>({
          method: 'GET',
          path: `/template/${validatedParams.templateId}`,
          params: { expand: 'body' },
        });

        if (response.success && response.data) {
          const template = response.data;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                template: {
                  templateId: template.templateId,
                  name: template.name,
                  description: template.description,
                  templateType: template.templateType,
                  body: template.body,
                  space: template.space,
                  labels: template.labels,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get template');
      } catch (error: any) {
        logger.error('Failed to get template', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_TEMPLATE_ERROR',
                message: error.message,
                suggestion: 'Verify the template ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: create_template
  server.registerTool(
    'create_template',
    {
      title: 'Create Template',
      description: '🆕 CREATE: Create a new page template. Omit spaceKey for a global template.',
      inputSchema: createTemplateInputSchema,
      annotations: {
        title: 'Create Template',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      examples: toolExamples['create_template'],
    },
    async (params: any) => {
      try {
        const validatedParams = createTemplateSchema.parse(params);

        const templateData: Record<string, any> = {
          name: validatedParams.name,
          templateType: validatedParams.templateType,
          body: {
            storage: {
              value: validatedParams.body,
              representation: 'storage',
            },
          },
        };

        if (validatedParams.description) {
          templateData.description = validatedParams.description;
        }
        if (validatedParams.spaceKey) {
          templateData.space = { key: validatedParams.spaceKey };
        }
        if (validatedParams.labels && validatedParams.labels.length > 0) {
          templateData.labels = validatedParams.labels.map(name => ({ name, prefix: 'global' }));
        }

        const response = await apiClient.makeV1Request<ConfluenceTemplate>({
          method: 'POST',
          path: '/template',
          data: templateData,
        });

        if (response.success && response.data) {
          const template = response.data;
          logger.info('Template created', { templateId: template.templateId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                template: {
                  templateId: template.templateId,
                  name: template.name,
                },
                message: `Template "${template.name}" created successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create template');
      } catch (error: any) {
        logger.error('Failed to create template', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_TEMPLATE_ERROR',
                message: error.message,
                suggestion: 'Check template name and body content',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: update_template - Template update endpoint (PUT /template/{id}) returns HTTP 405
  // See backlog.json for details. Use Confluence UI to update templates.
  /*
  server.registerTool(
    'update_template',
    {
      title: 'Update Template',
      description: '✏️ UPDATE: Update an existing template.',
      inputSchema: updateTemplateInputSchema,
      annotations: {
        title: 'Update Template',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = updateTemplateSchema.parse(params);

        const updateData: Record<string, any> = {
          templateId: validatedParams.templateId,
        };

        if (validatedParams.name) {
          updateData.name = validatedParams.name;
        }
        if (validatedParams.body) {
          updateData.body = {
            storage: {
              value: validatedParams.body,
              representation: 'storage',
            },
          };
        }
        if (validatedParams.description !== undefined) {
          updateData.description = validatedParams.description;
        }

        const response = await apiClient.makeV1Request<ConfluenceTemplate>({
          method: 'PUT',
          path: `/template/${validatedParams.templateId}`,
          data: updateData,
        });

        if (response.success) {
          logger.info('Template updated', { templateId: validatedParams.templateId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                templateId: validatedParams.templateId,
                message: 'Template updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update template');
      } catch (error: any) {
        logger.error('Failed to update template', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_TEMPLATE_ERROR',
                message: error.message,
                suggestion: 'Verify the template ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // Tool: delete_template
  server.registerTool(
    'delete_template',
    {
      title: 'Delete Template',
      description: '🗑️ DELETE: Permanently delete a template.',
      inputSchema: deleteTemplateInputSchema,
      annotations: {
        title: 'Delete Template',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = deleteTemplateSchema.parse(params);

        const response = await apiClient.makeV1Request<void>({
          method: 'DELETE',
          path: `/template/${validatedParams.templateId}`,
        });

        if (response.success) {
          logger.info('Template deleted', { templateId: validatedParams.templateId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                deletedTemplateId: validatedParams.templateId,
                message: 'Template deleted successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete template');
      } catch (error: any) {
        logger.error('Failed to delete template', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_TEMPLATE_ERROR',
                message: error.message,
                suggestion: 'Verify the template ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // Label Operations
  // =====================

  // Tool: get_labels
  server.registerTool(
    'get_labels',
    {
      title: 'Get Content Labels',
      description: '📖 READ: Get labels on a piece of content (page, blog post, etc).',
      inputSchema: getLabelsInputSchema,
      annotations: {
        title: 'Get Content Labels',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getLabelsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.prefix) {
          queryParams.prefix = validatedParams.prefix;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceLabel>>({
          method: 'GET',
          path: `/pages/${validatedParams.contentId}/labels`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const labels = response.data.results;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentId: validatedParams.contentId,
                labels: labels.map(l => ({
                  id: l.id,
                  name: l.name,
                  prefix: l.prefix,
                })),
                count: labels.length,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get labels');
      } catch (error: any) {
        logger.error('Failed to get labels', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_LABELS_ERROR',
                message: error.message,
                suggestion: 'Verify the content ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: add_labels
  server.registerTool(
    'add_labels',
    {
      title: 'Add Labels',
      description: '🏷️ CREATE: Add labels to a piece of content.',
      inputSchema: addLabelsInputSchema,
      annotations: {
        title: 'Add Labels',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = addLabelsSchema.parse(params);

        // Use V1/legacy API for labels - V2 doesn't support POST to labels endpoint
        const response = await apiClient.makeV1Request<ConfluenceLabel[]>({
          method: 'POST',
          path: `/content/${validatedParams.contentId}/label`,
          data: validatedParams.labels.map(l => ({
            name: l.name,
            prefix: l.prefix || 'global',
          })),
        });

        if (response.success) {
          logger.info('Labels added', {
            contentId: validatedParams.contentId,
            count: validatedParams.labels.length,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentId: validatedParams.contentId,
                addedLabels: validatedParams.labels.map(l => l.name),
                message: `Added ${validatedParams.labels.length} label(s)`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add labels');
      } catch (error: any) {
        logger.error('Failed to add labels', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_LABELS_ERROR',
                message: error.message,
                suggestion: 'Verify the content ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: remove_label - Neither V1 nor V2 DELETE label endpoints work in Confluence Cloud
  // See backlog.json for details. Use Confluence UI to remove labels.
  /*
  server.registerTool(
    'remove_label',
    {
      title: 'Remove Label',
      description: '🗑️ DELETE: Remove a label from content. Use "get_labels" first to see existing labels.',
      inputSchema: removeLabelInputSchema,
      annotations: {
        title: 'Remove Label',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = removeLabelSchema.parse(params);

        // First get the labels to find the label ID - V2 API requires label ID
        const labelsResponse = await apiClient.makeV2Request<any>({
          method: 'GET',
          path: `/pages/${validatedParams.contentId}/labels`,
        });

        if (!labelsResponse.success || !labelsResponse.data?.results) {
          throw new Error('Could not retrieve labels from page');
        }

        // Find the label by name
        const labelToRemove = labelsResponse.data.results.find(
          (l: any) => l.name === validatedParams.labelName
        );

        if (!labelToRemove) {
          throw new Error(`Label "${validatedParams.labelName}" not found on this content`);
        }

        // Use V2 API with the label ID
        const response = await apiClient.makeV2Request<void>({
          method: 'DELETE',
          path: `/pages/${validatedParams.contentId}/labels/${labelToRemove.id}`,
        });

        if (response.success) {
          logger.info('Label removed', {
            contentId: validatedParams.contentId,
            label: validatedParams.labelName,
            labelId: labelToRemove.id,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentId: validatedParams.contentId,
                removedLabel: validatedParams.labelName,
                message: `Label "${validatedParams.labelName}" removed`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to remove label');
      } catch (error: any) {
        logger.error('Failed to remove label', { error: error.message });

        let suggestion = 'Verify the content ID and label name are correct';
        if (error.message?.includes('not found') || error.message?.includes('404')) {
          suggestion = 'Label not found on this content. Use "get_labels" to see existing labels';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'REMOVE_LABEL_ERROR',
                message: error.message,
                suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // Tool: get_space_labels
  server.registerTool(
    'get_space_labels',
    {
      title: 'Get Space Labels',
      description: '📖 READ: Get all labels used in a space.',
      inputSchema: getSpaceLabelsInputSchema,
      annotations: {
        title: 'Get Space Labels',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getSpaceLabelsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.prefix) {
          queryParams.prefix = validatedParams.prefix;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceLabel>>({
          method: 'GET',
          path: `/spaces/${validatedParams.spaceId}/labels`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const labels = response.data.results;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceId: validatedParams.spaceId,
                labels: labels.map(l => ({
                  id: l.id,
                  name: l.name,
                  prefix: l.prefix,
                })),
                count: labels.length,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get space labels');
      } catch (error: any) {
        logger.error('Failed to get space labels', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SPACE_LABELS_ERROR',
                message: error.message,
                suggestion: 'Verify the space ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: add_space_label and remove_space_label - Cloud doesn't have API for space labels
  // See backlog.json for details. Use Confluence UI to manage space labels.
  /*
  server.registerTool(
    'add_space_label',
    {
      title: 'Add Space Label',
      description: '🏷️ CREATE: Add labels to a space.',
      inputSchema: addSpaceLabelInputSchema,
      annotations: {
        title: 'Add Space Label',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = addSpaceLabelSchema.parse(params);

        const response = await apiClient.makeV2Request<ConfluenceLabel[]>({
          method: 'POST',
          path: `/spaces/${validatedParams.spaceId}/labels`,
          data: validatedParams.labels.map(l => ({
            name: l.name,
            prefix: l.prefix || 'global',
          })),
        });

        if (response.success) {
          logger.info('Space labels added', {
            spaceId: validatedParams.spaceId,
            count: validatedParams.labels.length,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceId: validatedParams.spaceId,
                addedLabels: validatedParams.labels.map(l => l.name),
                message: `Added ${validatedParams.labels.length} label(s) to space`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add space labels');
      } catch (error: any) {
        logger.error('Failed to add space labels', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_SPACE_LABEL_ERROR',
                message: error.message,
                suggestion: 'Verify the space ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: remove_space_label
  server.registerTool(
    'remove_space_label',
    {
      title: 'Remove Space Label',
      description: '🗑️ DELETE: Remove a label from a space.',
      inputSchema: removeSpaceLabelInputSchema,
      annotations: {
        title: 'Remove Space Label',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = removeSpaceLabelSchema.parse(params);

        const response = await apiClient.makeV2Request<void>({
          method: 'DELETE',
          path: `/spaces/${validatedParams.spaceId}/labels/${validatedParams.labelName}`,
        });

        if (response.success) {
          logger.info('Space label removed', {
            spaceId: validatedParams.spaceId,
            label: validatedParams.labelName,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceId: validatedParams.spaceId,
                removedLabel: validatedParams.labelName,
                message: `Label "${validatedParams.labelName}" removed from space`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to remove space label');
      } catch (error: any) {
        logger.error('Failed to remove space label', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'REMOVE_SPACE_LABEL_ERROR',
                message: error.message,
                suggestion: 'Verify the space ID and label name are correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // =====================
  // Search Operations
  // =====================

  // Tool: search_cql
  server.registerTool(
    'search_cql',
    {
      title: 'Search with CQL',
      description: '🔍 DISCOVERY: Search Confluence using CQL (Confluence Query Language). Powerful query syntax for finding content.',
      inputSchema: searchCqlInputSchema,
      annotations: {
        title: 'Search with CQL',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = searchCqlSchema.parse(params);

        const queryParams: Record<string, any> = {
          cql: validatedParams.cql,
        };
        if (validatedParams.cqlcontext) {
          queryParams.cqlcontext = validatedParams.cqlcontext;
        }
        if (validatedParams.excerpt) {
          queryParams.excerpt = validatedParams.excerpt;
        }
        if (validatedParams.expand) {
          queryParams.expand = validatedParams.expand;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.start = validatedParams.cursor;
        }

        const response = await apiClient.makeV1Request<SearchResponse>({
          method: 'GET',
          path: '/search',
          params: queryParams,
        });

        if (response.success && response.data) {
          const results = response.data.results;

          const resultsData = results.map(r => ({
            title: r.title || r.content?.title,
            url: r.url,
            excerpt: r.excerpt,
            entityType: r.entityType,
            lastModified: r.lastModified,
            contentId: r.content?.id,
            contentType: r.content?.type,
            spaceKey: r.space?.key,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                query: validatedParams.cql,
                results: resultsData,
                pagination: {
                  start: response.data.start,
                  limit: response.data.limit,
                  size: response.data.size,
                  totalSize: response.data.totalSize,
                  hasMore: response.data.size === response.data.limit,
                },
                searchDuration: response.data.searchDuration,
                usage_guidance: 'CQL examples: "type=page AND space=DEV", "label=important", "creator=currentUser()"',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to search');
      } catch (error: any) {
        logger.error('Failed to search with CQL', { error: error.message });

        let suggestion = 'Check your CQL query syntax';
        if (error.message?.includes('parse') || error.message?.includes('syntax')) {
          suggestion = 'Invalid CQL syntax. Example: "type=page AND space=MYSPACE"';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SEARCH_CQL_ERROR',
                message: error.message,
                suggestion,
                cql_examples: [
                  'type=page - Find all pages',
                  'space=KEY - Find content in a space',
                  'label=name - Find labeled content',
                  'text~"search term" - Full-text search',
                  'creator=currentUser() - Your content',
                ],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: search_content
  server.registerTool(
    'search_content',
    {
      title: 'Search Content',
      description: '🔍 DISCOVERY: Simple text search across Confluence content. For complex queries, use "search_cql".',
      inputSchema: searchContentInputSchema,
      annotations: {
        title: 'Search Content',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = searchContentSchema.parse(params);

        // Build CQL query from simple parameters
        let cql = `text~"${validatedParams.query}"`;
        if (validatedParams.spaceKey) {
          cql += ` AND space=${validatedParams.spaceKey}`;
        }
        if (validatedParams.type) {
          cql += ` AND type=${validatedParams.type}`;
        }

        const queryParams: Record<string, any> = {
          cql,
          excerpt: 'highlight',
        };
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.start = validatedParams.cursor;
        }

        const response = await apiClient.makeV1Request<SearchResponse>({
          method: 'GET',
          path: '/search',
          params: queryParams,
        });

        if (response.success && response.data) {
          const results = response.data.results;

          const resultsData = results.map(r => ({
            title: r.title || r.content?.title,
            url: r.url,
            excerpt: r.excerpt,
            entityType: r.entityType,
            space: r.space?.key,
            lastModified: r.lastModified,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                query: validatedParams.query,
                results: resultsData,
                pagination: {
                  returned: results.length,
                  totalSize: response.data.totalSize,
                  hasMore: response.data.size === response.data.limit,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to search');
      } catch (error: any) {
        logger.error('Failed to search content', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SEARCH_CONTENT_ERROR',
                message: error.message,
                suggestion: 'Check your search query',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Content tools (templates, labels, search) registered successfully
}
