import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConfluenceApiClient } from '../api/client.js';
import {
  searchPagesSchema,
  getPageSchema,
  createPageSchema,
  updatePageSchema,
  deletePageSchema,
  getPageVersionsSchema,
  getPageVersionSchema,
  getPageChildrenSchema,
  getPageAncestorsSchema,
  movePageSchema,
  copyPageSchema,
  getPageRestrictionsSchema,
  setPageRestrictionsSchema,
  getPageLikesSchema,
} from '../validation/schemas.js';
import {
  searchPagesInputSchema,
  getPageInputSchema,
  createPageInputSchema,
  updatePageInputSchema,
  deletePageInputSchema,
  getPageVersionsInputSchema,
  getPageVersionInputSchema,
  getPageChildrenInputSchema,
  getPageAncestorsInputSchema,
  movePageInputSchema,
  copyPageInputSchema,
  getPageRestrictionsInputSchema,
  setPageRestrictionsInputSchema,
  getPageLikesInputSchema,
} from '../validation/input-schemas.js';
import {
  ConfluencePage,
  ContentVersion,
  CursorPaginatedResponse,
  ContentRestriction,
  ContentLike,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import { wrapUserContent, sanitizePageBody } from '../utils/sanitize.js';
import { toolExamples } from '../validation/tool-examples.js';

export async function registerPageTools(server: McpServer, apiClient: ConfluenceApiClient) {
  // =====================
  // PHASE 1: Core Page CRUD Operations
  // =====================

  // Tool: search_pages
  server.registerTool(
    'search_pages',
    {
      title: 'Search Pages',
      description: '🔍 DISCOVERY: Search for pages in Confluence. Filter by space, title, or status. Use this to find pages before reading or updating them.',
      inputSchema: searchPagesInputSchema,
      annotations: {
        title: 'Search Pages',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = searchPagesSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.spaceId) {
          queryParams['space-id'] = validatedParams.spaceId;
        }
        if (validatedParams.title) {
          queryParams.title = validatedParams.title;
        }
        if (validatedParams.status) {
          queryParams.status = validatedParams.status;
        }
        if (validatedParams.sort) {
          queryParams.sort = validatedParams.sort;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        // Determine body-format based on fields level
        if (validatedParams.fields === 'full') {
          queryParams['body-format'] = 'storage';
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluencePage>>({
          method: 'GET',
          path: '/pages',
          params: queryParams,
        });

        if (response.success && response.data) {
          const pages = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          const pagesData = pages.map(p => ({
            id: p.id,
            title: p.title,
            status: p.status,
            spaceId: p.spaceId,
            parentId: p.parentId,
            createdAt: p.createdAt,
            version: p.version?.number,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                pages: pagesData,
                pagination: {
                  returned: pages.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
                usage_guidance: pages.length > 0
                  ? `Found ${pages.length} page(s). Use "get_page" with pageId to get full details.`
                  : 'No pages found. Try adjusting your search filters.',
                suggested_next_steps: pages.length > 0
                  ? [
                      `Use "get_page" with pageId="${pages[0].id}" to read "${pages[0].title}"`,
                      `Use "get_page_children" with pageId="${pages[0].id}" to see child pages`,
                    ]
                  : [
                      'Use "search_spaces" first to find a space, then search pages with spaceId',
                      'Use "search_cql" for advanced queries',
                    ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to search pages');
      } catch (error: any) {
        logger.error('Failed to search pages', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SEARCH_PAGES_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Check your search parameters and try again',
                related_tools: ['search_spaces', 'search_cql'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_page
  server.registerTool(
    'get_page',
    {
      title: 'Get Page',
      description: '📖 READ: Retrieve detailed information about a specific page including its content. Use bodyFormat to specify how you want the content returned.',
      inputSchema: getPageInputSchema,
      annotations: {
        title: 'Get Page',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getPageSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.bodyFormat) {
          queryParams['body-format'] = validatedParams.bodyFormat;
        }
        if (validatedParams.getDraft) {
          queryParams['get-draft'] = validatedParams.getDraft;
        }

        const response = await apiClient.makeV2Request<ConfluencePage>({
          method: 'GET',
          path: `/pages/${validatedParams.pageId}`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const page = response.data;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                page: {
                  id: page.id,
                  title: wrapUserContent(page.title),
                  status: page.status,
                  spaceId: page.spaceId,
                  parentId: page.parentId,
                  authorId: page.authorId,
                  createdAt: page.createdAt,
                  version: page.version,
                  body: sanitizePageBody(page.body as Record<string, unknown> | undefined),
                  _links: page._links,
                },
                suggested_next_steps: [
                  `Use "update_page" to modify this page (requires version ${page.version?.number})`,
                  `Use "get_page_children" to see child pages`,
                  `Use "get_page_comments" to view comments`,
                  `Use "add_labels" to add labels to this page`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get page');
      } catch (error: any) {
        logger.error('Failed to get page', { error: error.message });

        let suggestion = 'Verify the page ID is correct';
        if (error.message?.includes('not found')) {
          suggestion = 'Page not found. Use "search_pages" to find valid page IDs';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to view this page';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PAGE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion,
                related_tools: ['search_pages', 'search_cql'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: create_page
  server.registerTool(
    'create_page',
    {
      title: 'Create Page',
      description: `🆕 CREATE: Create a new page in Confluence.

⚠️ PREREQUISITES:
1. Use "search_spaces" first to find a valid spaceId
2. Optionally use "search_pages" to find a parentId for child pages

📋 BODY FORMAT:
- Use storage format (XHTML) for the body. Example:
  <p>This is a paragraph.</p>
  <h1>Heading</h1>
  <ul><li>List item</li></ul>
- Do NOT include <?xml?> or <!DOCTYPE> declarations
- Special characters must be escaped: &amp; &lt; &gt;`,
      inputSchema: createPageInputSchema,
      annotations: {
        title: 'Create Page',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      examples: toolExamples['create_page'],
    },
    async (params: any) => {
      try {
        const validatedParams = createPageSchema.parse(params);

        // Build the page data object carefully - only include defined fields
        const pageData: Record<string, any> = {
          spaceId: validatedParams.spaceId,
          title: validatedParams.title,
          body: {
            representation: validatedParams.representation || 'storage',
            value: validatedParams.body,
          },
        };

        // Only include status if explicitly set (API has its own default)
        if (validatedParams.status) {
          pageData.status = validatedParams.status;
        }

        // Only include parentId if provided
        if (validatedParams.parentId) {
          pageData.parentId = validatedParams.parentId;
        }

        logger.debug('Creating page', {
          spaceId: validatedParams.spaceId,
          title: validatedParams.title,
          hasParent: !!validatedParams.parentId,
          representation: validatedParams.representation || 'storage',
          bodyLength: validatedParams.body?.length || 0,
        });

        const response = await apiClient.makeV2Request<ConfluencePage>({
          method: 'POST',
          path: '/pages',
          data: pageData,
        });

        if (response.success && response.data) {
          const page = response.data;
          logger.info('Page created successfully', { pageId: page.id, title: page.title });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                page: {
                  id: page.id,
                  title: page.title,
                  status: page.status,
                  spaceId: page.spaceId,
                  version: page.version?.number,
                  _links: page._links,
                },
                message: `Page "${page.title}" created successfully`,
                suggested_next_steps: [
                  `Use "get_page" with pageId="${page.id}" to view full details`,
                  `Use "update_page" to modify the page`,
                  `Use "add_labels" to categorize the page`,
                  `Use "upload_attachment" to add files`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create page: No data returned from API');
      } catch (error: any) {
        logger.error('Failed to create page', {
          error: error.message,
          code: error.code,
          details: error.details,
          spaceId: params?.spaceId,
          title: params?.title,
        });

        // Enhanced error analysis with specific suggestions
        let suggestion = 'Check space ID and page content format';
        let nextSteps: string[] = [];

        if (error.message?.includes('space') || error.message?.includes('Space') || error.code?.includes('SPACE')) {
          suggestion = 'Space not found or inaccessible';
          nextSteps = [
            '1. Use "search_spaces" to find valid space IDs',
            '2. Verify you have permission to create pages in this space',
            '3. Note: space ID is numeric, not the space key'
          ];
        } else if (error.message?.includes('parent') || error.message?.includes('Parent')) {
          suggestion = 'Parent page not found or inaccessible';
          nextSteps = [
            '1. Use "search_pages" to find valid parent page IDs',
            '2. Verify the parent page is in the same space',
            '3. Omit parentId to create a top-level page'
          ];
        } else if (error.message?.includes('title') || error.message?.includes('Title') || error.message?.includes('duplicate')) {
          suggestion = 'Page title conflict';
          nextSteps = [
            '1. A page with this title may already exist in the space',
            '2. Use "search_pages" to check for existing pages',
            '3. Choose a different title'
          ];
        } else if (error.message?.includes('body') || error.message?.includes('content') || error.message?.includes('format') || error.message?.includes('invalid')) {
          suggestion = 'Invalid body content format';
          nextSteps = [
            '1. Body must be valid storage format (XHTML)',
            '2. Do NOT include <?xml?> or <!DOCTYPE> declarations',
            '3. Escape special characters: &amp; &lt; &gt;',
            '4. Example valid body: <p>Hello World</p>'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('forbidden') || error.code?.includes('403')) {
          suggestion = 'Insufficient permissions';
          nextSteps = [
            '1. Verify you have permission to create pages in this space',
            '2. Contact your Confluence administrator for access',
            '3. Check if the space has page creation restrictions'
          ];
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_PAGE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: 'Proper workflow: search_spaces → (optionally search_pages for parent) → create_page',
                related_tools: ['search_spaces', 'search_pages'],
                debugInfo: {
                  providedSpaceId: params?.spaceId,
                  providedTitle: params?.title,
                  bodyLength: params?.body?.length || 0,
                }
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: update_page
  server.registerTool(
    'update_page',
    {
      title: 'Update Page',
      description: '✏️ UPDATE: Update an existing page. Requires the current version number to prevent conflicts. Use "get_page" first to get the current version.',
      inputSchema: updatePageInputSchema,
      annotations: {
        title: 'Update Page',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      examples: toolExamples['update_page'],
    },
    async (params: any) => {
      try {
        const validatedParams = updatePageSchema.parse(params);

        // First get the current page to obtain title if not provided
        // Confluence V2 API requires title in update requests
        let currentTitle: string | undefined;
        if (!validatedParams.title) {
          const currentPage = await apiClient.makeV2Request<ConfluencePage>({
            method: 'GET',
            path: `/pages/${validatedParams.pageId}`,
          });
          if (currentPage.success && currentPage.data) {
            currentTitle = currentPage.data.title;
          }
        }

        // Build update payload - don't include id (it's in URL)
        const updateData: Record<string, any> = {
          id: validatedParams.pageId,
          status: validatedParams.status || 'current',
          title: validatedParams.title || currentTitle,
          version: {
            number: validatedParams.version + 1, // Confluence requires next version number
          },
        };

        if (validatedParams.body) {
          updateData.body = {
            representation: validatedParams.representation || 'storage',
            value: validatedParams.body,
          };
        }

        const response = await apiClient.makeV2Request<ConfluencePage>({
          method: 'PUT',
          path: `/pages/${validatedParams.pageId}`,
          data: updateData,
        });

        if (response.success && response.data) {
          const page = response.data;
          logger.info('Page updated successfully', { pageId: page.id });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                page: {
                  id: page.id,
                  title: page.title,
                  version: page.version?.number,
                },
                message: `Page "${page.title}" updated to version ${page.version?.number}`,
                suggested_next_steps: [
                  `Use "get_page" to verify changes`,
                  `Use "get_page_versions" to see version history`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update page');
      } catch (error: any) {
        logger.error('Failed to update page', { error: error.message });

        let suggestion = 'Verify the page exists and version number is correct';
        if (error.message?.includes('version')) {
          suggestion = 'Version conflict. Use "get_page" to get the current version and retry';
        } else if (error.message?.includes('not found')) {
          suggestion = 'Page not found. Verify the page ID is correct';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to edit this page';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_PAGE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion,
                workflow_guidance: 'Use "get_page" first to get the current version number',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: delete_page
  server.registerTool(
    'delete_page',
    {
      title: 'Delete Page',
      description: '🗑️ DELETE: Delete a page. By default moves to trash; use purge=true to permanently delete. WARNING: Cannot be undone if purged!',
      inputSchema: deletePageInputSchema,
      annotations: {
        title: 'Delete Page',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = deletePageSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.purge) {
          queryParams.purge = true;
        }

        const response = await apiClient.makeV2Request<void>({
          method: 'DELETE',
          path: `/pages/${validatedParams.pageId}`,
          params: queryParams,
        });

        if (response.success) {
          logger.info('Page deleted successfully', {
            pageId: validatedParams.pageId,
            purged: validatedParams.purge,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                deletedPageId: validatedParams.pageId,
                purged: validatedParams.purge,
                message: validatedParams.purge
                  ? 'Page permanently deleted'
                  : 'Page moved to trash',
                warning: validatedParams.purge
                  ? 'This action cannot be undone'
                  : 'Page can be restored from trash',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete page');
      } catch (error: any) {
        logger.error('Failed to delete page', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_PAGE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page exists and you have delete permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // PHASE 2: Page Version Operations
  // =====================

  // Tool: get_page_versions
  server.registerTool(
    'get_page_versions',
    {
      title: 'Get Page Versions',
      description: '📖 READ: Retrieve version history for a page. Shows who made changes and when.',
      inputSchema: getPageVersionsInputSchema,
      annotations: {
        title: 'Get Page Versions',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getPageVersionsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ContentVersion>>({
          method: 'GET',
          path: `/pages/${validatedParams.pageId}/versions`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const versions = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          const versionsData = versions.map(v => ({
            number: v.number,
            message: v.message,
            minorEdit: v.minorEdit,
            authorId: v.authorId,
            createdAt: v.createdAt,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                pageId: validatedParams.pageId,
                versions: versionsData,
                pagination: {
                  returned: versions.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get page versions');
      } catch (error: any) {
        logger.error('Failed to get page versions', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PAGE_VERSIONS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_page_version
  server.registerTool(
    'get_page_version',
    {
      title: 'Get Page Version',
      description: '📖 READ: Retrieve a specific version of a page. Useful for comparing changes or viewing historical content.',
      inputSchema: getPageVersionInputSchema,
      annotations: {
        title: 'Get Page Version',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getPageVersionSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.bodyFormat) {
          queryParams['body-format'] = validatedParams.bodyFormat;
        }

        // V1 API is needed for historical versions with body content
        const response = await apiClient.makeV1Request<any>({
          method: 'GET',
          path: `/content/${validatedParams.pageId}`,
          params: {
            version: validatedParams.versionNumber,
            expand: 'body.storage,version',
            ...queryParams,
          },
        });

        if (response.success && response.data) {
          const page = response.data;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                page: {
                  id: page.id,
                  title: wrapUserContent(page.title),
                  version: page.version,
                  body: sanitizePageBody(page.body as Record<string, unknown> | undefined),
                },
                message: `Retrieved version ${validatedParams.versionNumber} of page`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get page version');
      } catch (error: any) {
        logger.error('Failed to get page version', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PAGE_VERSION_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page ID and version number are correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // PHASE 3: Page Hierarchy Operations
  // =====================

  // Tool: get_page_children
  server.registerTool(
    'get_page_children',
    {
      title: 'Get Page Children',
      description: '📖 READ: Get child pages of a parent page. Use for navigating page hierarchies.',
      inputSchema: getPageChildrenInputSchema,
      annotations: {
        title: 'Get Page Children',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getPageChildrenSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluencePage>>({
          method: 'GET',
          path: `/pages/${validatedParams.pageId}/children`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const children = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          const childrenData = children.map(c => ({
            id: c.id,
            title: c.title,
            status: c.status,
            position: c.position,
            createdAt: c.createdAt,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                parentPageId: validatedParams.pageId,
                children: childrenData,
                pagination: {
                  returned: children.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get page children');
      } catch (error: any) {
        logger.error('Failed to get page children', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PAGE_CHILDREN_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_page_ancestors
  server.registerTool(
    'get_page_ancestors',
    {
      title: 'Get Page Ancestors',
      description: '📖 READ: Get parent pages (ancestors) of a page. Shows the hierarchy path from root to this page.',
      inputSchema: getPageAncestorsInputSchema,
      annotations: {
        title: 'Get Page Ancestors',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getPageAncestorsSchema.parse(params);

        // V1 API for ancestors
        const response = await apiClient.makeV1Request<any>({
          method: 'GET',
          path: `/content/${validatedParams.pageId}`,
          params: {
            expand: 'ancestors',
          },
        });

        if (response.success && response.data) {
          const ancestors = response.data.ancestors || [];

          const ancestorsData = ancestors.map((a: any) => ({
            id: a.id,
            title: a.title,
            type: a.type,
            status: a.status,
          }));

          const hierarchyPath = ancestors.map((a: any) => a.title).join(' > ');

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                pageId: validatedParams.pageId,
                ancestors: ancestorsData,
                hierarchyPath,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get page ancestors');
      } catch (error: any) {
        logger.error('Failed to get page ancestors', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PAGE_ANCESTORS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: move_page
  server.registerTool(
    'move_page',
    {
      title: 'Move Page',
      description: '🔄 UPDATE: Move a page to a new parent or position. Changes the page hierarchy.',
      inputSchema: movePageInputSchema,
      annotations: {
        title: 'Move Page',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = movePageSchema.parse(params);

        // V1 API for page move
        const response = await apiClient.makeV1Request<any>({
          method: 'PUT',
          path: `/content/${validatedParams.pageId}/move/${validatedParams.position}/${validatedParams.targetId}`,
        });

        if (response.success) {
          logger.info('Page moved successfully', {
            pageId: validatedParams.pageId,
            targetId: validatedParams.targetId,
            position: validatedParams.position,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                pageId: validatedParams.pageId,
                targetId: validatedParams.targetId,
                position: validatedParams.position,
                message: 'Page moved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to move page');
      } catch (error: any) {
        logger.error('Failed to move page', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'MOVE_PAGE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify both page IDs are correct and you have move permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: copy_page
  server.registerTool(
    'copy_page',
    {
      title: 'Copy Page',
      description: '📋 CREATE: Create a copy of a page. Can copy to different space or parent. Optionally copies attachments and labels.',
      inputSchema: copyPageInputSchema,
      annotations: {
        title: 'Copy Page',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = copyPageSchema.parse(params);

        // V1 API copy endpoint expects specific payload format:
        // - destination: object with "type" and "value" keys
        // - copyAttachments, copyPermissions, copyProperties, copyLabels: booleans
        // - pageTitle: optional string for new title
        const copyData: Record<string, any> = {
          copyAttachments: validatedParams.copyAttachments ?? true,
          copyPermissions: false,
          copyProperties: true,
          copyLabels: validatedParams.copyLabels ?? true,
        };

        // Build destination - destination is required for copy
        // Format: { "type": "space" | "parent_page", "value": "<id>" }
        if (validatedParams.destinationParentId) {
          // Copy under a specific parent page
          copyData.destination = {
            type: 'parent_page',
            value: validatedParams.destinationParentId,
          };
        } else if (validatedParams.destinationSpaceId) {
          // Copy to a space (as top-level page)
          copyData.destination = {
            type: 'space',
            value: validatedParams.destinationSpaceId,
          };
        } else {
          // If no destination specified, get the source page's space and use it
          const sourceResponse = await apiClient.makeV1Request<any>({
            method: 'GET',
            path: `/content/${validatedParams.pageId}`,
            params: { expand: 'space' },
          });
          if (sourceResponse.success && sourceResponse.data?.space?.key) {
            copyData.destination = {
              type: 'space',
              value: sourceResponse.data.space.key,
            };
          } else {
            throw new Error('Could not determine destination space. Please provide destinationSpaceId or destinationParentId.');
          }
        }

        if (validatedParams.title) {
          copyData.pageTitle = validatedParams.title;
        }

        // V1 API for page copy
        const response = await apiClient.makeV1Request<any>({
          method: 'POST',
          path: `/content/${validatedParams.pageId}/copy`,
          data: copyData,
        });

        if (response.success && response.data) {
          const newPage = response.data;
          logger.info('Page copied successfully', { newPageId: newPage.id });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                originalPageId: validatedParams.pageId,
                newPage: {
                  id: newPage.id,
                  title: newPage.title,
                  _links: newPage._links,
                },
                message: `Page copied successfully`,
                suggested_next_steps: [
                  `Use "get_page" with pageId="${newPage.id}" to view the copy`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to copy page');
      } catch (error: any) {
        logger.error('Failed to copy page', { error: error.message });

        let suggestion = 'Verify source page exists and you have copy permissions';
        if (error.message?.includes('destination')) {
          suggestion = 'Invalid destination. Provide a valid destinationSpaceId (space key/ID) or destinationParentId (page ID)';
        } else if (error.message?.includes('title') || error.message?.includes('duplicate')) {
          suggestion = 'A page with the same title exists in the destination. Provide a unique title using the title parameter';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'COPY_PAGE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // PHASE 4: Page Restrictions
  // =====================

  // Tool: get_page_restrictions
  server.registerTool(
    'get_page_restrictions',
    {
      title: 'Get Page Restrictions',
      description: '📖 READ: Get current restrictions (permissions) on a page. Shows who can read/edit the page.',
      inputSchema: getPageRestrictionsInputSchema,
      annotations: {
        title: 'Get Page Restrictions',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getPageRestrictionsSchema.parse(params);

        const response = await apiClient.makeV1Request<{
          results: ContentRestriction[];
        }>({
          method: 'GET',
          path: `/content/${validatedParams.pageId}/restriction`,
          params: { expand: 'restrictions.user,restrictions.group' },
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                pageId: validatedParams.pageId,
                restrictions: response.data.results,
                usage_guidance: 'Use "set_page_restrictions" to modify these restrictions',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get page restrictions');
      } catch (error: any) {
        logger.error('Failed to get page restrictions', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PAGE_RESTRICTIONS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: set_page_restrictions
  server.registerTool(
    'set_page_restrictions',
    {
      title: 'Set Page Restrictions',
      description: '🔒 UPDATE: Set restrictions on a page to control who can read or edit it.',
      inputSchema: setPageRestrictionsInputSchema,
      annotations: {
        title: 'Set Page Restrictions',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = setPageRestrictionsSchema.parse(params);

        const restrictions: any[] = [];
        if (validatedParams.users) {
          validatedParams.users.forEach((userId: string) => {
            restrictions.push({
              operation: validatedParams.operation,
              restrictions: {
                user: [{ accountId: userId }],
              },
            });
          });
        }
        if (validatedParams.groups) {
          validatedParams.groups.forEach((groupName: string) => {
            restrictions.push({
              operation: validatedParams.operation,
              restrictions: {
                group: [{ name: groupName }],
              },
            });
          });
        }

        const response = await apiClient.makeV1Request<any>({
          method: 'PUT',
          path: `/content/${validatedParams.pageId}/restriction`,
          data: restrictions,
        });

        if (response.success) {
          logger.info('Page restrictions set successfully', { pageId: validatedParams.pageId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                pageId: validatedParams.pageId,
                operation: validatedParams.operation,
                message: 'Page restrictions updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to set page restrictions');
      } catch (error: any) {
        logger.error('Failed to set page restrictions', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SET_PAGE_RESTRICTIONS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify you have permission to modify restrictions on this page',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // PHASE 5: Page Engagement
  // =====================

  // Tool: get_page_likes
  server.registerTool(
    'get_page_likes',
    {
      title: 'Get Page Likes',
      description: '📖 READ: Get users who liked a page. Shows engagement with the content.',
      inputSchema: getPageLikesInputSchema,
      annotations: {
        title: 'Get Page Likes',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getPageLikesSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        // Try V2 API
        try {
          const response = await apiClient.makeV2Request<CursorPaginatedResponse<ContentLike>>({
            method: 'GET',
            path: `/pages/${validatedParams.pageId}/likes`,
            params: queryParams,
          });

          if (response.success && response.data) {
            const likes = response.data.results;
            const nextCursor = response.data._links?.next
              ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
              : null;

            const likesData = likes.map(l => ({
              userId: (l as any).accountId,
            }));

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  pageId: validatedParams.pageId,
                  likes: likesData,
                  count: likes.length,
                  pagination: {
                    hasMore: !!nextCursor,
                    nextCursor,
                  },
                }, null, 2),
              }],
            };
          }
        } catch {
          // V2 API doesn't support page likes list - this is a Confluence API limitation
          logger.debug('Page likes endpoint not available');
        }

        // Return informative response about API limitation
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              pageId: validatedParams.pageId,
              likes: [],
              count: 0,
              note: 'The Confluence API does not provide a direct endpoint to list page likes. Like counts may be available in page metadata.',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get page likes', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PAGE_LIKES_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Page tools registered successfully
}
