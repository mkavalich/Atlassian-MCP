import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFieldContextTools } from '../../src/tools/field-contexts.js';
import { registerPermissionTools } from '../../src/tools/permissions.js';
import { JiraApiClient } from '../../src/api/client.js';

jest.mock('../../src/api/client.js');

/**
 * Guards for PASS A items 2 and 3.
 *
 * Both tools resolved a union with `data.values || data` (resp.
 * `data.permissionSchemes || data`) and then took `.length || 0`. When the
 * envelope arrives WITHOUT its array property, the left operand is undefined,
 * the fallback hands back the ENVELOPE OBJECT, `.length` is undefined, and
 * `|| 0` turns "unknown" into a confident `count: 0` under `success: true`.
 * An absent property is not a genuine zero.
 *
 * Cases marked PROOF fail against the unfixed source. Cases marked GUARD pass
 * against the unfixed source and exist to catch over-correction -- turning a
 * working path, or a genuine empty result, into a spurious loud failure.
 */

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

describe('union shape guards (items 2 and 3)', () => {
  let server: McpServer;
  let mockApiClient: jest.Mocked<JiraApiClient>;
  let registeredTools: Map<string, any>;

  beforeEach(() => {
    registeredTools = new Map();
    server = {
      registerTool: jest.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as any;
    mockApiClient = { makeRequest: jest.fn() } as any;
    registerFieldContextTools(server, mockApiClient);
    registerPermissionTools(server, mockApiClient);
  });

  describe('get_custom_field_contexts', () => {
    it('PROOF: envelope with NO values property must not report count 0', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { total: 3, startAt: 0, maxResults: 50, isLast: true },
      } as any);

      const tool = registeredTools.get('get_custom_field_contexts');
      const payload = parse(await tool.handler({ fieldId: 'customfield_10409' }));

      expect(payload.success).toBe(false);
      expect(payload.count).toBeNull();
      expect(payload.count).not.toBe(0);
      expect(payload.customFieldContexts).toBeNull();
      // The message must name what actually arrived, not guess.
      expect(payload.error.message).toContain('total');
    });

    it('PROOF: values present but not an array must not yield a string length', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { values: 'nope' },
      } as any);

      const tool = registeredTools.get('get_custom_field_contexts');
      const payload = parse(await tool.handler({ fieldId: 'customfield_10409' }));

      expect(payload.success).toBe(false);
      expect(payload.count).toBeNull();
      expect(payload.count).not.toBe(4);
    });

    it('GUARD: a genuine empty envelope stays success true with count 0', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { values: [], total: 0, startAt: 0, maxResults: 50 },
      } as any);

      const tool = registeredTools.get('get_custom_field_contexts');
      const payload = parse(await tool.handler({ fieldId: 'customfield_10409' }));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(0);
      expect(payload.customFieldContexts).toEqual([]);
    });

    // Discovered while running this suite against unfixed code: the bare-array
    // arm did NOT "work by accident" as the plan assumed. `data.values` on an
    // array resolves to Array.prototype.values -- the iterator METHOD, which is
    // truthy -- so `contexts` became a function with `.length === 0`. The tool
    // returned success:true, count:0 and JSON.stringify dropped
    // customFieldContexts entirely, while the API had returned rows.
    it('PROOF: bare array arm must not be shadowed by Array.prototype.values', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: [{ id: '1' }, { id: '2' }],
      } as any);

      const tool = registeredTools.get('get_custom_field_contexts');
      const payload = parse(await tool.handler({ fieldId: 'customfield_10409' }));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(2);
      expect(payload.customFieldContexts).toEqual([{ id: '1' }, { id: '2' }]);
    });

    it('GUARD: normal envelope is unchanged', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { values: [{ id: '10000' }], total: 1, startAt: 0, maxResults: 50 },
      } as any);

      const tool = registeredTools.get('get_custom_field_contexts');
      const payload = parse(await tool.handler({ fieldId: 'customfield_10409' }));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(1);
      expect(payload.pagination.total).toBe(1);
    });
  });

  describe('get_permission_schemes', () => {
    it('PROOF: envelope with NO permissionSchemes property must not report count 0', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ success: true, data: {} } as any);

      const tool = registeredTools.get('get_permission_schemes');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(false);
      expect(payload.count).toBeNull();
      expect(payload.count).not.toBe(0);
      expect(payload.permissionSchemes).toBeNull();
    });

    it('PROOF: permissionSchemes present but not an array must not yield a string length', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { permissionSchemes: 'nope' },
      } as any);

      const tool = registeredTools.get('get_permission_schemes');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(false);
      expect(payload.count).toBeNull();
      expect(payload.count).not.toBe(4);
    });

    it('GUARD: a genuine empty list stays success true with count 0', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { permissionSchemes: [] },
      } as any);

      const tool = registeredTools.get('get_permission_schemes');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(0);
    });

    it('GUARD: bare array arm still counts correctly', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      } as any);

      const tool = registeredTools.get('get_permission_schemes');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(3);
    });

    it('GUARD: normal envelope is unchanged', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { permissionSchemes: new Array(13).fill(0).map((_, i) => ({ id: i })) },
      } as any);

      const tool = registeredTools.get('get_permission_schemes');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(13);
    });
  });

  // Pass B item 3c: two more count-of-primary-collection sites in this file,
  // 300 lines below the item-3 fix. get_permission_grants returns an ARRAY
  // envelope (verified live: 90 grants); get_global_permissions returns an
  // OBJECT MAP (verified live: 66 entries), so the two need shape-specific
  // resolution, not the same array narrowing.
  describe('get_permission_grants (array envelope)', () => {
    it('PROOF: envelope with NO permissions array must not report count 0', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ success: true, data: { expand: 'x' } } as any);

      const tool = registeredTools.get('get_permission_grants');
      const payload = parse(await tool.handler({ schemeId: '0' }));

      expect(payload.success).toBe(false);
      expect(payload.count).toBeNull();
      expect(payload.count).not.toBe(0);
      expect(payload.permissions).toBeNull();
    });

    it('PROOF: permissions present but not an array must not yield a string length', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ success: true, data: { permissions: 'nope' } } as any);

      const tool = registeredTools.get('get_permission_grants');
      const payload = parse(await tool.handler({ schemeId: '0' }));

      expect(payload.success).toBe(false);
      expect(payload.count).toBeNull();
      expect(payload.count).not.toBe(4);
    });

    it('GUARD: a genuine empty grant list stays success true with count 0', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ success: true, data: { permissions: [] } } as any);

      const tool = registeredTools.get('get_permission_grants');
      const payload = parse(await tool.handler({ schemeId: '0' }));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(0);
    });

    it('GUARD: normal envelope of 90 grants counts correctly', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { permissions: new Array(90).fill(0).map((_, i) => ({ id: i })), expand: 'x' },
      } as any);

      const tool = registeredTools.get('get_permission_grants');
      const payload = parse(await tool.handler({ schemeId: '0' }));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(90);
    });
  });

  describe('get_global_permissions (object map)', () => {
    const map66 = Object.fromEntries(new Array(66).fill(0).map((_, i) => [`PERM_${i}`, { key: `PERM_${i}` }]));

    it('PROOF: response with NO permissions map must not report count 0', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ success: true, data: {} } as any);

      const tool = registeredTools.get('get_global_permissions');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(false);
      expect(payload.count).toBeNull();
      expect(payload.count).not.toBe(0);
      expect(payload.permissions).toBeNull();
    });

    it('GUARD: a genuine empty map stays success true with count 0', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ success: true, data: { permissions: {} } } as any);

      const tool = registeredTools.get('get_global_permissions');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(0);
    });

    it('GUARD: normal map of 66 permissions counts by key, not by absent .length', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ success: true, data: { permissions: map66 } } as any);

      const tool = registeredTools.get('get_global_permissions');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(66);
    });
  });

  // Pass B follow-up item 3: get_my_permissions had the same `data.permissions ||
  // data` fragility as its siblings. Unlike them it emitted no count, so it was
  // not a fabricated zero -- but when the documented envelope was absent it passed
  // the RAW BODY through as `permissions` under success:true (a confident, wrong,
  // successful-looking answer). GET /mypermissions returns an OBJECT MAP
  // { permissions: { KEY: { id, key, name, type, description, havePermission }, ... } }
  // (verified live: a call with a permissions list returns HTTP 200 with the map;
  // a call with no permissions param 400s before this code is reached), so it is
  // narrowed like get_global_permissions.
  describe('get_my_permissions (object map)', () => {
    const map4 = Object.fromEntries(
      ['BROWSE_PROJECTS', 'ADMINISTER', 'CREATE_ISSUES', 'ADMINISTER_PROJECTS'].map((k) => [
        k,
        { id: k, key: k, name: k, type: 'PROJECT', description: 'x', havePermission: true },
      ])
    );

    it('PROOF: a body with NO permissions map must not pass the raw body through as success', async () => {
      // Jira returns something without the documented "permissions" envelope.
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { self: 'https://x/rest/api/3/mypermissions', accountId: 'acc-1' },
      } as any);

      const tool = registeredTools.get('get_my_permissions');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(false);
      expect(payload.permissions).toBeNull();
      expect(payload.error.code).toBe('GET_MY_PERMISSIONS_UNRECOGNIZED_SHAPE');
      // The message must name what actually arrived, not guess.
      expect(payload.error.message).toContain('self');
    });

    it('PROOF: a normal map now reports an Object.keys count, never an absent one', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ success: true, data: { permissions: map4 } } as any);

      const tool = registeredTools.get('get_my_permissions');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(4);
    });

    it('GUARD: the normal live-shape map stays success true with the map intact', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ success: true, data: { permissions: map4 } } as any);

      const tool = registeredTools.get('get_my_permissions');
      const payload = parse(await tool.handler({ permissions: 'BROWSE_PROJECTS' }));

      expect(payload.success).toBe(true);
      expect(Object.keys(payload.permissions)).toHaveLength(4);
      // structure preserved -- entries still carry havePermission
      expect(payload.permissions.BROWSE_PROJECTS.havePermission).toBeDefined();
    });

    it('GUARD: a genuine empty permissions map stays success true', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ success: true, data: { permissions: {} } } as any);

      const tool = registeredTools.get('get_my_permissions');
      const payload = parse(await tool.handler({}));

      expect(payload.success).toBe(true);
      expect(Object.keys(payload.permissions)).toHaveLength(0);
    });
  });
});
