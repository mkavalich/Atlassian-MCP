import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFieldTools } from '../../src/tools/fields.js';
import { JiraApiClient } from '../../src/api/client.js';
import { isCustomField, JiraFieldSearchItem } from '../../src/types/index.js';

jest.mock('../../src/api/client.js');

/**
 * Regression suite for the custom/system classification in get_fields_paginated.
 *
 * This tool consumes GET /rest/api/3/field/search, which returns NO `custom`
 * boolean. The previous implementation read `f.isCustom` -- a property the API
 * has never returned -- so every row was classified as a system field and the
 * tool emitted `breakdown:{custom:0, system:<pageSize>}` under success:true.
 */
describe('get_fields_paginated - page breakdown', () => {
  let server: McpServer;
  let mockApiClient: jest.Mocked<JiraApiClient>;
  let registeredTools: Map<string, any>;

  /** 7 custom (schema.customId present), 2 system (schema, no customId), 1 unknown (no schema). */
  const mockFieldSearchRows = [
    { id: 'customfield_10001', name: 'Story Points', schema: { type: 'number', custom: 'com.atlassian.x:float', customId: 10001 } },
    { id: 'customfield_10002', name: 'Epic Link', schema: { type: 'any', custom: 'com.atlassian.x:epic', customId: 10002 } },
    { id: 'customfield_10003', name: 'Sprint', schema: { type: 'array', custom: 'com.atlassian.x:sprint', customId: 10003 } },
    { id: 'customfield_10004', name: 'Approvers', schema: { type: 'array', custom: 'com.atlassian.x:people', customId: 10004 } },
    { id: 'customfield_10005', name: 'Change risk', schema: { type: 'option', custom: 'com.atlassian.x:select', customId: 10005 } },
    { id: 'customfield_10006', name: 'Change type', schema: { type: 'option', custom: 'com.atlassian.x:select', customId: 10006 } },
    { id: 'customfield_10007', name: 'Campaign Budget', schema: { type: 'number', custom: 'com.atlassian.x:float', customId: 10007 } },
    { id: 'summary', name: 'Summary', schema: { type: 'string', system: 'summary' } },
    { id: 'assignee', name: 'Assignee', schema: { type: 'user', system: 'assignee' } },
    // Real instances carry rows with no `schema` at all (thumbnail/Images,
    // issuekey/Key, parent/Parent). An absent discriminator is not a negative.
    { id: 'thumbnail', name: 'Images' },
  ];

  const callTool = async (rows: unknown[], extra: Record<string, unknown> = {}) => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: { startAt: 0, maxResults: 50, total: 152, values: rows, ...extra },
    } as any);

    const tool = registeredTools.get('get_fields_paginated');
    expect(tool).toBeDefined();
    const result = await tool.handler({ startAt: 0, maxResults: 50 });
    return JSON.parse(result.content[0].text);
  };

  beforeEach(() => {
    registeredTools = new Map();
    server = {
      registerTool: jest.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as any;
    mockApiClient = { makeRequest: jest.fn() } as any;
    registerFieldTools(server, mockApiClient);
  });

  it('counts custom, system and unknown rows from schema.customId', async () => {
    const payload = await callTool(mockFieldSearchRows);

    // On the unfixed code this object is `breakdown:{custom:0, system:10}`:
    // the key name is wrong AND custom is a confident, wrong zero.
    expect(payload.pageBreakdown).toEqual({
      scope: 'page',
      custom: 7,
      system: 2,
      unknown: 1,
    });
  });

  it('reports a row with no schema as unknown, never as system', async () => {
    const payload = await callTool([{ id: 'thumbnail', name: 'Images' }]);

    expect(payload.pageBreakdown.unknown).toBe(1);
    expect(payload.pageBreakdown.system).toBe(0);
    expect(payload.pageBreakdown.custom).toBe(0);
  });

  it('labels the breakdown page-scoped and leaves the site-wide total untouched', async () => {
    const payload = await callTool(mockFieldSearchRows);

    expect(payload.pageBreakdown.scope).toBe('page');
    expect(payload.total).toBe(152);
    expect(payload.count).toBe(10);
    // The buckets must account for every row on the page.
    const { custom, system, unknown } = payload.pageBreakdown;
    expect(custom + system + unknown).toBe(payload.count);
  });

  it('no longer emits the mislabelled site-wide-looking `breakdown` key', async () => {
    const payload = await callTool(mockFieldSearchRows);
    expect('breakdown' in payload).toBe(false);
  });

  it('points callers at the server-side route for a site-wide custom count', async () => {
    const payload = await callTool(mockFieldSearchRows);
    expect(payload.usage_guidance).toContain('type:["custom"]');
  });
});

describe('isCustomField', () => {
  it('returns true only when schema.customId is present', () => {
    expect(isCustomField({ schema: { customId: 10001 } })).toBe(true);
  });

  it('returns false for a schema without customId', () => {
    expect(isCustomField({ schema: {} })).toBe(false);
  });

  it('returns null - not false - when schema is absent', () => {
    expect(isCustomField({})).toBeNull();
    expect(isCustomField(undefined)).toBeNull();
    expect(isCustomField(null)).toBeNull();
  });

  it('does not compile when reading `custom` off a /field/search row', () => {
    const row: JiraFieldSearchItem = { id: 'customfield_1', name: 'X' };
    // GET /field/search returns no `custom` boolean. If this ever starts
    // compiling, the endpoint-split types have regressed into a shape that
    // silently yields `undefined` again.
    // @ts-expect-error - JiraFieldSearchItem deliberately has no `custom`
    const wrong = row.custom;
    expect(wrong).toBeUndefined();
  });
});
