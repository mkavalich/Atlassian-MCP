/**
 * Deferred Tool Listing
 *
 * Minimises the `tools/list` response by replacing each tool's full
 * `inputSchema` with an empty object schema. Clients recover the real schema
 * on demand via `load_tool_schema`.
 *
 * WHY THIS LIVES AT THE LISTING LAYER, NOT AT REGISTRATION
 * --------------------------------------------------------
 * The obvious implementation is to drop `inputSchema` before handing the config
 * to `server.registerTool`. That is wrong: the MCP SDK uses the registered
 * `inputSchema` to parse and validate arguments on every `tools/call` (see
 * `_createRegisteredTool` and the `tool.inputSchema` parse path in the SDK's
 * `mcp.js`). Stripping at registration would silently disable argument
 * validation for every tool on the server -- trading a token saving for an
 * entire class of runtime bug.
 *
 * So registration keeps the full schema, and only the wire response for
 * `tools/list` is minimised. Validation behaviour is completely unchanged.
 *
 * THE TRADE-OFF, STATED PLAINLY
 * -----------------------------
 * A client that does not know to call `load_tool_schema` sees tools with no
 * parameters and cannot call them correctly. That is a real behavioural change,
 * so this is OPT-IN (`MCP_DEFER_TOOL_SCHEMAS=true` or `enableDeferredListing`),
 * not the default. The anchor tools are never minimised -- a client must always
 * be able to discover and recover the schemas it is missing.
 */

import type { ToolSchemaRegistry } from '../tools/tool-schema-registry.js';

/** Tools whose schemas must always survive: without them nothing is recoverable. */
export const ANCHOR_TOOLS = new Set(['search_tools', 'load_tool_schema']);

/** The minimal JSON Schema that keeps a tool listing spec-valid. */
const MINIMAL_SCHEMA = { type: 'object' as const };

/**
 * Kept deliberately short. At ~58 minimised tools per server, every character
 * here is paid 58 times in the very response this feature exists to shrink --
 * the first draft of this string cost ~6 KB of the ~30 KB it was saving.
 */
const POINTER = ' [args: load_tool_schema]';

export interface DeferredListingConfig {
  registry?: ToolSchemaRegistry;
  serverName?: string;
  debug?: boolean;
  /** Tool names to leave untouched, in addition to the anchors. */
  preserve?: Iterable<string>;
}

export interface DeferredListingMetrics {
  applied: boolean;
  toolCount: number;
  minimisedCount: number;
  preservedCount: number;
  bytesBefore: number;
  bytesAfter: number;
  reductionPercent: number;
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
}

/**
 * Rewrite a tools/list result, minimising every non-preserved tool's schema.
 * Pure: returns a new result object and never mutates the input.
 */
export function minimiseToolListing(
  result: any,
  preserve: Set<string>
): { result: any; minimised: number; preserved: number } {
  if (!result || !Array.isArray(result.tools)) {
    return { result, minimised: 0, preserved: 0 };
  }

  let minimised = 0;
  let preserved = 0;

  const tools = result.tools.map((tool: any) => {
    if (!tool || typeof tool.name !== 'string' || preserve.has(tool.name)) {
      preserved++;
      return tool;
    }

    const schema = tool.inputSchema;
    const hasProperties =
      schema && typeof schema === 'object' && schema.properties &&
      Object.keys(schema.properties).length > 0;

    // Nothing to save on a tool that already takes no parameters.
    if (!hasProperties) {
      preserved++;
      return tool;
    }

    minimised++;
    const description =
      typeof tool.description === 'string' && !tool.description.includes(POINTER.trim())
        ? tool.description + POINTER
        : tool.description;

    return { ...tool, description, inputSchema: { ...MINIMAL_SCHEMA } };
  });

  return { result: { ...result, tools }, minimised, preserved };
}

/**
 * Wrap an MCP server's `tools/list` handler so listings are minimised.
 *
 * Must be called AFTER all tools are registered. Returns metrics describing
 * what the first listing would cost with and without deferral, or
 * `applied: false` if the wrap could not be installed.
 */
export function applyDeferredToolListing(
  mcpServer: any,
  config: DeferredListingConfig = {}
): { getMetrics: () => DeferredListingMetrics | null } {
  const { serverName = 'mcp-server', debug = false, preserve } = config;

  const preserveSet = new Set<string>(ANCHOR_TOOLS);
  for (const name of preserve ?? []) preserveSet.add(name);

  let metrics: DeferredListingMetrics | null = null;

  const log = (message: string) => {
    if (debug) console.error(`[DeferredListing:${serverName}] ${message}`);
  };

  // McpServer wraps a low-level Server; the request handlers live on the latter.
  const lowLevel = mcpServer?.server ?? mcpServer;
  const handlers = lowLevel?._requestHandlers;

  if (!handlers || typeof handlers.get !== 'function') {
    log('could not locate request handlers; deferral NOT applied');
    return { getMetrics: () => null };
  }

  const original = handlers.get('tools/list');
  if (typeof original !== 'function') {
    log('no tools/list handler registered yet; deferral NOT applied');
    return { getMetrics: () => null };
  }

  handlers.set('tools/list', async (request: unknown, extra: unknown) => {
    const full = await original(request, extra);
    const bytesBefore = byteLength(full);
    const { result, minimised, preserved } = minimiseToolListing(full, preserveSet);
    const bytesAfter = byteLength(result);

    metrics = {
      applied: true,
      toolCount: minimised + preserved,
      minimisedCount: minimised,
      preservedCount: preserved,
      bytesBefore,
      bytesAfter,
      reductionPercent:
        bytesBefore > 0 ? Math.round(((bytesBefore - bytesAfter) / bytesBefore) * 1000) / 10 : 0,
    };

    log(
      `tools/list ${bytesBefore}B -> ${bytesAfter}B ` +
        `(${metrics.reductionPercent}% smaller; ${minimised} minimised, ${preserved} preserved)`
    );

    return result;
  });

  log('deferred tool listing active');
  return { getMetrics: () => metrics };
}
