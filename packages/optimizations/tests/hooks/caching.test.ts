/**
 * Regression tests for the caching hook.
 *
 * Covers the fail-closed bypass (an unkeyable params object must not be served
 * from, or written to, the cache) and write invalidation (a read issued after a
 * mutation must not serve pre-write state).
 */

import { createCachingHook } from '../../src/hooks/caching.js';

interface Recorded {
  method: string;
  path: string;
  params?: unknown;
  apiBase?: string;
  apiVersion?: string;
}

function makeClient(responder: (n: number, cfg: Recorded) => unknown) {
  const calls: Recorded[] = [];
  let n = 0;
  return {
    calls,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async makeRequest(cfg: any): Promise<unknown> {
      calls.push(cfg);
      return responder(n++, cfg);
    },
  };
}

describe('caching hook — fail-closed bypass', () => {
  it('never caches when the params object cannot be faithfully keyed', async () => {
    const client = makeClient(n => ({ n }));
    const hook = createCachingHook({});
    await hook.onClientCreate(client);

    const a = await client.makeRequest({
      method: 'GET',
      path: '/user/groups',
      params: new URLSearchParams('accountId=AAA'),
    });
    const b = await client.makeRequest({
      method: 'GET',
      path: '/user/groups',
      params: new URLSearchParams('accountId=BBB'),
    });

    // Both went to the API: no wrong cache hit, and nothing was stored.
    expect(client.calls).toHaveLength(2);
    expect(a).not.toEqual(b);
    expect(hook.getMetrics().uncacheableKeys).toBe(2);
    expect(hook.getMetrics().size).toBe(0);
  });

  it('still caches ordinary plain-object params', async () => {
    const client = makeClient(n => ({ n }));
    const hook = createCachingHook({});
    await hook.onClientCreate(client);

    const a = await client.makeRequest({ method: 'GET', path: '/project', params: { key: 'ABC' } });
    const b = await client.makeRequest({ method: 'GET', path: '/project', params: { key: 'ABC' } });

    expect(client.calls).toHaveLength(1);
    expect(b).toEqual(a);
    expect(hook.getMetrics().hits).toBe(1);
    expect(hook.getMetrics().uncacheableKeys).toBe(0);
  });

  it('keeps distinct plain-object queries on distinct entries', async () => {
    const client = makeClient(n => ({ n }));
    const hook = createCachingHook({});
    await hook.onClientCreate(client);

    const a = await client.makeRequest({ method: 'GET', path: '/project', params: { key: 'ABC' } });
    const b = await client.makeRequest({ method: 'GET', path: '/project', params: { key: 'XYZ' } });

    expect(client.calls).toHaveLength(2);
    expect(a).not.toEqual(b);
  });
});

describe('caching hook — API-surface scope', () => {
  it('does not collide two API surfaces that share a path', async () => {
    const client = makeClient(n => ({ n }));
    const hook = createCachingHook({});
    await hook.onClientCreate(client);

    const v1 = await client.makeRequest({ method: 'GET', path: '/search', apiVersion: 'v1' });
    const v2 = await client.makeRequest({ method: 'GET', path: '/search', apiVersion: 'v2' });

    expect(client.calls).toHaveLength(2);
    expect(v1).not.toEqual(v2);
  });

  it('treats an explicit default surface as identical to an absent one', async () => {
    const client = makeClient(n => ({ n }));
    const hook = createCachingHook({});
    await hook.onClientCreate(client);

    const bare = await client.makeRequest({ method: 'GET', path: '/pages' });
    const explicit = await client.makeRequest({ method: 'GET', path: '/pages', apiVersion: 'v2' });

    expect(client.calls).toHaveLength(1);
    expect(explicit).toEqual(bare);

    const jbare = await client.makeRequest({ method: 'GET', path: '/project' });
    const jexplicit = await client.makeRequest({
      method: 'GET',
      path: '/project',
      apiBase: '/rest/api/3',
    });
    expect(jexplicit).toEqual(jbare);

    const agile = await client.makeRequest({
      method: 'GET',
      path: '/project',
      apiBase: '/rest/agile/1.0',
    });
    expect(agile).not.toEqual(jbare);
  });
});

describe('caching hook — write invalidation', () => {
  it('does not serve pre-write state after a mutation on the same path', async () => {
    const client = makeClient(n => ({ n }));
    const hook = createCachingHook({});
    await hook.onClientCreate(client);

    const before = await client.makeRequest({ method: 'GET', path: '/issue/ABC-1/comment' });
    await client.makeRequest({ method: 'POST', path: '/issue/ABC-1/comment', data: { body: 'x' } });
    const after = await client.makeRequest({ method: 'GET', path: '/issue/ABC-1/comment' });

    expect(after).not.toEqual(before);
  });

  it('invalidates for sub-resource writes too (update/delete comment)', async () => {
    for (const mutation of [
      { method: 'PUT', path: '/issue/ABC-1/comment/10001' },
      { method: 'DELETE', path: '/issue/ABC-1/comment/10001' },
    ]) {
      const client = makeClient(n => ({ n }));
      const hook = createCachingHook({});
      await hook.onClientCreate(client);

      const before = await client.makeRequest({ method: 'GET', path: '/issue/ABC-1/comment' });
      await client.makeRequest(mutation);
      const after = await client.makeRequest({ method: 'GET', path: '/issue/ABC-1/comment' });

      expect(after).not.toEqual(before);
    }
  });

  it('invalidates reads on unrelated paths too (cross-resource writes)', async () => {
    const client = makeClient(n => ({ n }));
    const hook = createCachingHook({});
    await hook.onClientCreate(client);

    const before = await client.makeRequest({ method: 'GET', path: '/board/1/backlog' });
    await client.makeRequest({ method: 'POST', path: '/sprint/5/issue' });
    const after = await client.makeRequest({ method: 'GET', path: '/board/1/backlog' });

    expect(after).not.toEqual(before);
  });

  it('invalidates even when the write throws', async () => {
    const client = makeClient((n, cfg) => {
      if (cfg.method !== 'GET') throw new Error('boom');
      return { n };
    });
    const hook = createCachingHook({});
    await hook.onClientCreate(client);

    const before = await client.makeRequest({ method: 'GET', path: '/issue/ABC-1' });
    await expect(
      client.makeRequest({ method: 'PUT', path: '/issue/ABC-1' })
    ).rejects.toThrow('boom');
    const after = await client.makeRequest({ method: 'GET', path: '/issue/ABC-1' });

    expect(after).not.toEqual(before);
  });
});
