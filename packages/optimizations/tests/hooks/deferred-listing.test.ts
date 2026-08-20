/**
 * Deferred tool listing.
 *
 * The bug this feature fixes: `createSchemaRegistryHook` captured schemas into a
 * registry but passed the tool config to the SDK unmodified, so `tools/list`
 * still carried every full inputSchema. The README claimed a 60-75% reduction
 * that never happened -- measured at 266/280 tools returning full schemas,
 * 269 KB across eight servers.
 *
 * These tests pin BOTH halves: that listings actually shrink, and that nothing
 * about argument validation changed (the reason this cannot be done at
 * registration time).
 */

import {
  applyDeferredToolListing,
  minimiseToolListing,
  ANCHOR_TOOLS,
} from '../../src/hooks/deferred-listing.js';

const richSchema = {
  type: 'object',
  properties: {
    issueKey: { type: 'string', description: 'The Jira issue key, e.g. PROJ-123' },
    fields: {
      type: 'object',
      description: 'Field values to set',
      properties: { summary: { type: 'string' }, description: { type: 'string' } },
    },
    notifyUsers: { type: 'boolean', description: 'Whether to send notifications' },
  },
  required: ['issueKey'],
};

const listing = () => ({
  tools: [
    { name: 'update_issue', description: 'Update a Jira issue', inputSchema: structuredClone(richSchema) },
    { name: 'delete_issue', description: 'Delete a Jira issue', inputSchema: structuredClone(richSchema) },
    { name: 'search_tools', description: 'Find tools', inputSchema: structuredClone(richSchema) },
    { name: 'load_tool_schema', description: 'Load a schema', inputSchema: structuredClone(richSchema) },
    { name: 'get_instance_info', description: 'No parameters', inputSchema: { type: 'object' } },
  ],
});

const byName = (r: any, n: string) => r.tools.find((t: any) => t.name === n);

describe('minimiseToolListing', () => {
  it('replaces rich schemas with an empty object schema', () => {
    const { result } = minimiseToolListing(listing(), ANCHOR_TOOLS);
    expect(byName(result, 'update_issue').inputSchema).toEqual({ type: 'object' });
    expect(byName(result, 'update_issue').inputSchema.properties).toBeUndefined();
  });

  it('never minimises the anchor tools, or nothing is recoverable', () => {
    const { result } = minimiseToolListing(listing(), ANCHOR_TOOLS);
    for (const anchor of ['search_tools', 'load_tool_schema']) {
      expect(byName(result, anchor).inputSchema.properties).toBeDefined();
      expect(Object.keys(byName(result, anchor).inputSchema.properties)).toContain('issueKey');
    }
  });

  it('leaves parameterless tools untouched rather than churning them', () => {
    const { result } = minimiseToolListing(listing(), ANCHOR_TOOLS);
    expect(byName(result, 'get_instance_info').description).toBe('No parameters');
  });

  it('points the client at load_tool_schema in the description', () => {
    const { result } = minimiseToolListing(listing(), ANCHOR_TOOLS);
    expect(byName(result, 'update_issue').description).toContain('load_tool_schema');
  });

  it('does not append the pointer twice if applied repeatedly', () => {
    const once = minimiseToolListing(listing(), ANCHOR_TOOLS).result;
    const twice = minimiseToolListing(once, ANCHOR_TOOLS).result;
    const desc: string = byName(twice, 'update_issue').description;
    expect(desc.match(/load_tool_schema/g)?.length).toBe(1);
  });

  it('actually reduces payload size', () => {
    const before = JSON.stringify(listing()).length;
    const after = JSON.stringify(minimiseToolListing(listing(), ANCHOR_TOOLS).result).length;
    expect(after).toBeLessThan(before);
    // This fixture is deliberately pessimistic: 3 of its 5 tools are preserved
    // (2 anchors + 1 parameterless), so it understates the real ratio. See the
    // production-shaped case below for the number that matters.
    expect((before - after) / before).toBeGreaterThan(0.2);
  });

  it('reduces a production-shaped listing by a large margin', () => {
    // Mirrors the measured shape: 280 tools, 266 carrying full schemas,
    // only the 2 anchors per server preserved.
    const many = {
      tools: [
        ...Array.from({ length: 60 }, (_, i) => ({
          name: `tool_${i}`,
          description: `Tool number ${i}`,
          inputSchema: structuredClone(richSchema),
        })),
        { name: 'search_tools', description: 'Find tools', inputSchema: structuredClone(richSchema) },
        { name: 'load_tool_schema', description: 'Load a schema', inputSchema: structuredClone(richSchema) },
      ],
    };
    const before = JSON.stringify(many).length;
    const { result, minimised, preserved } = minimiseToolListing(many, ANCHOR_TOOLS);
    const after = JSON.stringify(result).length;

    expect(minimised).toBe(60);
    expect(preserved).toBe(2);
    // Floor only. This fixture's schemas are smaller than production ones, so
    // it understates the real reduction -- do not quote this ratio anywhere.
    // The figure published in the README is measured against the live servers.
    expect((before - after) / before).toBeGreaterThan(0.5);
  });

  it('does not mutate the input listing', () => {
    const input = listing();
    minimiseToolListing(input, ANCHOR_TOOLS);
    expect((input.tools[0].inputSchema as any).properties).toBeDefined();
  });

  it('counts what it changed', () => {
    const { minimised, preserved } = minimiseToolListing(listing(), ANCHOR_TOOLS);
    expect(minimised).toBe(2); // update_issue, delete_issue
    expect(preserved).toBe(3); // 2 anchors + 1 parameterless
  });

  it('survives a malformed result rather than throwing', () => {
    expect(minimiseToolListing(null, ANCHOR_TOOLS).result).toBeNull();
    expect(minimiseToolListing({}, ANCHOR_TOOLS).result).toEqual({});
  });
});

describe('applyDeferredToolListing', () => {
  function fakeServer() {
    const handlers = new Map<string, any>();
    handlers.set('tools/list', async () => listing());
    return { server: { _requestHandlers: handlers }, handlers };
  }

  it('wraps tools/list and minimises the response', async () => {
    const s = fakeServer();
    applyDeferredToolListing(s);
    const result = await s.handlers.get('tools/list')({}, {});
    expect(byName(result, 'update_issue').inputSchema).toEqual({ type: 'object' });
    expect(byName(result, 'search_tools').inputSchema.properties).toBeDefined();
  });

  it('reports the reduction it achieved', async () => {
    const s = fakeServer();
    const handle = applyDeferredToolListing(s);
    expect(handle.getMetrics()).toBeNull(); // nothing measured until a listing happens
    await s.handlers.get('tools/list')({}, {});
    const m = handle.getMetrics()!;
    expect(m.applied).toBe(true);
    expect(m.bytesAfter).toBeLessThan(m.bytesBefore);
    expect(m.reductionPercent).toBeGreaterThan(0);
    expect(m.minimisedCount).toBe(2);
  });

  it('leaves tools/call completely alone -- validation is unchanged', async () => {
    const s = fakeServer();
    // Plain function, not jest.fn(): the `jest` global is not injected under
    // this package's ESM/ts-jest setup.
    const callHandler = async () => ({ content: [] });
    s.handlers.set('tools/call', callHandler);
    applyDeferredToolListing(s);
    expect(s.handlers.get('tools/call')).toBe(callHandler);
  });

  it('no-ops safely when there is no tools/list handler to wrap', () => {
    const handlers = new Map<string, any>();
    const handle = applyDeferredToolListing({ server: { _requestHandlers: handlers } });
    expect(handle.getMetrics()).toBeNull();
    expect(handlers.size).toBe(0);
  });

  it('no-ops safely on an unrecognised server shape', () => {
    expect(() => applyDeferredToolListing({})).not.toThrow();
    expect(applyDeferredToolListing({}).getMetrics()).toBeNull();
  });

  it('honours extra preserved tool names', async () => {
    const s = fakeServer();
    applyDeferredToolListing(s, { preserve: ['update_issue'] });
    const result = await s.handlers.get('tools/list')({}, {});
    expect(byName(result, 'update_issue').inputSchema.properties).toBeDefined();
    expect(byName(result, 'delete_issue').inputSchema).toEqual({ type: 'object' });
  });
});
