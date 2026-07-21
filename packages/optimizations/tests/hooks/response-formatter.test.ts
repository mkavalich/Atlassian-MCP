/**
 * Regression tests for the response formatter's metadata handling.
 *
 * The defect: on the success-with-data path the formatter preserved a
 * six-name allowlist and silently discarded every other top-level field --
 * including the `partialFailure` / `dataSources` honesty fields that exist
 * precisely to admit when half the data was unavailable, and including whole
 * sibling arrays.
 */

import { createResponseFormatterHook } from '../../src/hooks/response-formatter.js';

const { transformResponse } = createResponseFormatterHook({});

function mcp(payload: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

async function run(payload: unknown, params?: Record<string, unknown>) {
  const out = (await transformResponse('t', mcp(payload), params)) as {
    content: { text: string }[];
  };
  return out.content[0].text;
}

function metadataOf(text: string): Record<string, unknown> {
  const idx = text.lastIndexOf('\n---\n');
  if (idx === -1) return {};
  return JSON.parse(text.slice(idx + 5));
}

describe('honesty fields on the success-with-data path', () => {
  const groupsPayload = {
    success: true,
    accountId: 'acc-1',
    jiraGroups: [
      { name: 'site-admins', groupId: 'g1' },
      { name: 'jira-users', groupId: 'g2' },
    ],
    organizationGroups: [{ name: 'org-a', groupId: 'g9' }],
    summary: { jiraGroupCount: 2, orgGroupCount: null },
    dataSources: { jira: 'ok', organization: 'unavailable' },
    partialFailure: true,
    orgId: 'org-1',
  };

  it('retains partialFailure and dataSources alongside the data table', async () => {
    const text = await run(groupsPayload);
    const meta = metadataOf(text);

    expect(text).toContain('jiraGroups[2]');
    expect(meta.partialFailure).toBe(true);
    expect(meta.dataSources).toEqual({ jira: 'ok', organization: 'unavailable' });
    expect(meta.summary).toEqual({ jiraGroupCount: 2, orgGroupCount: null });
    expect(meta.accountId).toBe('acc-1');
    expect(meta.orgId).toBe('org-1');
    expect(meta.success).toBe(true);
  });

  it('discloses sibling arrays it did not render instead of dropping them', async () => {
    const meta = metadataOf(await run(groupsPayload));
    const omitted = meta._formatterOmitted as Record<string, unknown>;

    expect(omitted).toBeDefined();
    expect((omitted.values as Record<string, string>).organizationGroups).toContain('1');
    // ...and does not inline the array itself
    expect(meta.organizationGroups).toBeUndefined();
  });

  it('discloses non-array containers that hold object arrays (search_tools shape)', async () => {
    const text = await run({
      success: true,
      tools: [
        { name: 'get_page', type: 'read', category: 'pages' },
        { name: 'create_page', type: 'write', category: 'pages' },
      ],
      groupedByCategory: {
        pages: [
          { name: 'get_page', type: 'read' },
          { name: 'create_page', type: 'write' },
        ],
      },
      totalAvailable: 68,
      availableCategories: ['pages', 'spaces'],
      count: 2,
    });
    const meta = metadataOf(text);

    expect(meta.totalAvailable).toBe(68);
    expect(meta.availableCategories).toEqual(['pages', 'spaces']);
    expect(meta.groupedByCategory).toBeUndefined();
    expect(
      (meta._formatterOmitted as Record<string, Record<string, string>>).values.groupedByCategory
    ).toBeDefined();
  });

  it('discloses data columns that were dropped from the table', async () => {
    // One privacy-restricted user in the sample deletes the column for everyone.
    const text = await run({
      success: true,
      users: [
        { accountId: 'a1', displayName: 'Alice', emailAddress: 'alice@corp.com', active: true },
        { accountId: 'a2', displayName: 'Bob', emailAddress: null, active: true },
        { accountId: 'a3', displayName: 'Carol', emailAddress: 'carol@corp.com', active: true },
      ],
    });
    const meta = metadataOf(text);
    const omitted = meta._formatterOmitted as Record<string, unknown>;

    // The column is genuinely gone from the table...
    expect(text.split('\n')[0]).not.toContain('emailAddress');
    expect(text).not.toContain('alice@corp.com');
    // ...but it is named rather than silently disappearing.
    expect(omitted.columns).toContain('emailAddress');
  });

  it('never silently overwrites a tool-authored _formatterOmitted', async () => {
    const meta = metadataOf(
      await run({
        success: true,
        _formatterOmitted: 'tool-value',
        rows: [{ id: 1 }, { id: 2 }],
        extras: [{ id: 3 }],
      })
    );
    const omitted = meta._formatterOmitted as Record<string, unknown>;
    expect(omitted.toolReported).toBe('tool-value');
  });
});

describe('paths that must not change', () => {
  it('passes empty-array responses through untouched', async () => {
    const payload = {
      success: true,
      jiraGroups: [],
      partialFailure: true,
      dataSources: { organization: 'unavailable' },
    };
    const out = await transformResponse('t', mcp(payload), undefined);
    expect(out).toEqual(mcp(payload));
  });

  it('passes failure responses through untouched', async () => {
    const payload = { success: false, message: 'nope', partialFailure: true };
    const out = await transformResponse('t', mcp(payload), undefined);
    expect(out).toEqual(mcp(payload));
  });

  it('passes scalar-array responses through untouched', async () => {
    const payload = { success: true, names: ['a', 'b'], partialFailure: true };
    const out = await transformResponse('t', mcp(payload), undefined);
    expect(out).toEqual(mcp(payload));
  });

  it('passes detailed-format requests through untouched', async () => {
    const payload = { success: true, rows: [{ id: 1 }], partialFailure: true };
    const out = await transformResponse('t', mcp(payload), { responseFormat: 'detailed' });
    expect(out).toEqual(mcp(payload));
  });
});

describe('over-budget metadata', () => {
  it('stays bounded and discloses rather than dumping the raw payload', async () => {
    const fat: Record<string, unknown> = {};
    for (let i = 0; i < 60; i++) {
      fat[`bucket${i}`] = Array.from({ length: 20 }, (_, j) => ({
        name: `tool-${i}-${j}`,
        description: 'a fairly long description string to inflate the payload',
      }));
    }

    const text = await run({
      success: true,
      tools: [{ name: 'a', type: 'read' }, { name: 'b', type: 'read' }],
      groupedByCategory: fat,
      count: 2,
    });
    const meta = metadataOf(text);

    expect(text).toContain('tools[2]');
    expect(JSON.stringify(meta).length).toBeLessThan(4096);
    expect(meta.groupedByCategory).toBeUndefined();
    expect(
      (meta._formatterOmitted as Record<string, Record<string, string>>).values.groupedByCategory
    ).toBeDefined();
  });

  it('drops oversized scalars by disclosure, never by truncation', async () => {
    const text = await run({
      success: true,
      rows: [{ id: 1 }, { id: 2 }],
      hugeNote: 'x'.repeat(5000),
    });
    const meta = metadataOf(text);

    if (meta.hugeNote !== undefined) {
      expect(meta.hugeNote).toBe('x'.repeat(5000)); // preserved whole, not truncated
    } else {
      expect(
        (meta._formatterOmitted as Record<string, Record<string, string>>).values.hugeNote
      ).toBeDefined();
    }
  });
});


describe('identifier column selection and nested-object disclosure', () => {
  /**
   * A JiraProject-shaped row. `uuid` is declared optional on JiraProject in six
   * servers and real rows carry id, key and uuid together, so projects are the
   * regression surface for any change to identifier ranking.
   */
  const projectRows = [
    { id: '10066', key: 'AM', name: 'Atlassian MCP', projectTypeKey: 'software', style: 'classic', isPrivate: false, entityId: 'e-1', uuid: 'aaaaaaaa-1111-2222-3333-444444444444' },
    { id: '10364', key: 'DEMO', name: 'AI Toolkit Demo', projectTypeKey: 'service_desk', style: 'next-gen', isPrivate: false, entityId: 'e-2', uuid: 'bbbbbbbb-1111-2222-3333-444444444444' },
    { id: '10331', key: 'DSMNT', name: 'Disinterment', projectTypeKey: 'service_desk', style: 'classic', isPrivate: true, entityId: 'e-3', uuid: 'cccccccc-1111-2222-3333-444444444444' },
  ];

  /** Automation rules are identified ONLY by uuid -- no id, no key. */
  const ruleRows = [
    { uuid: 'aaaa-1', name: 'Rule A', state: 'ENABLED', actorAccountId: 'acc-1', authorAccountId: 'acc-1', created: 1771337000000, updated: 1771337000001, description: 'first' },
    { uuid: 'bbbb-2', name: 'Rule B', state: 'DISABLED', actorAccountId: 'acc-1', authorAccountId: 'acc-1', created: 1771337000002, updated: 1771337000003, description: 'second' },
  ];

  function headerOf(text: string): string[] {
    const m = /\{([^}]*)\}:/.exec(text);
    return m && m[1] ? m[1].split(',') : [];
  }

  it('surfaces uuid as the identifier when there is no id or key', async () => {
    const text = await run({ success: true, rules: ruleRows });
    // Without this, uuid sorts into the alphabetical remainder behind
    // actorAccountId/authorAccountId and never survives the 4-column concise
    // budget -- severing the get_automation_rule_details lookup chain.
    expect(headerOf(text)).toContain('uuid');
  });

  it('does NOT displace a project column set by promoting uuid', async () => {
    const text = await run({ success: true, projects: projectRows });
    // Asserting the FULL column set, not merely that `id` still ranks first:
    // an unconditional tier-1 uuid keeps id first while injecting a 36-char
    // opaque column and evicting a useful one, so a first-position assertion
    // would pass on the very regression it exists to catch.
    expect(headerOf(text)).toEqual(['id', 'key', 'name', 'entityId']);
  });

  it('discloses a nested object that has no renderable name or key', async () => {
    const fieldRows = [
      { id: 'customfield_10001', name: 'Story Points', schema: { type: 'number', custom: 'com.x:float', customId: 10001 } },
      { id: 'customfield_10002', name: 'Sprint', schema: { type: 'array', custom: 'com.x:sprint', customId: 10002 } },
    ];
    const meta = metadataOf(await run({ success: true, fields: fieldRows }));
    const omitted = meta._formatterOmitted as Record<string, unknown>;

    // `schema` carries the ONLY custom-field discriminator on /field/search.
    // It was dropped from the table AND absent from the omitted list, so the
    // response implied nothing had been omitted.
    expect(omitted.columns as string[]).toContain('schema');
  });
});