/**
 * Hooks Composer
 *
 * Composes multiple hook sets into a single combined hook set.
 * Enables optimization hooks to wrap base server hooks.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Hook function types matching the ServerHooks interface.
 */
export interface ComposableHooks {
  /** Called before each tool execution */
  onToolCall?: (toolName: string, params: unknown) => Promise<void>;

  /** Called after tool execution, can transform the result */
  transformResponse?: (toolName: string, result: unknown, params?: unknown) => Promise<unknown>;

  /** Called on tool errors */
  onToolError?: (toolName: string, error: Error) => Promise<void>;

  /** Called during tool registration to transform tool config */
  transformToolConfig?: (toolName: string, config: unknown) => unknown;

  /** Called after MCP server is created, before tools are registered */
  onServerCreate?: (server: McpServer) => Promise<void>;
}

/**
 * Compose multiple hook sets into a single combined hook set.
 *
 * Execution order:
 * - onToolCall: All hooks run in sequence (first to last)
 * - transformResponse: Pipeline - each transforms the result of the previous
 * - onToolError: All hooks run in sequence
 * - transformToolConfig: Pipeline - each transforms the config of the previous
 * - onServerCreate: All hooks run in sequence
 *
 * @param hookSets - Array of hook sets to compose
 * @returns Combined hook set
 *
 * @example
 * ```typescript
 * const optimizationHooks = createOptimizationHooks(config);
 * const telemetryHooks = createTelemetryHooks(config);
 * const userHooks = { onToolCall: customLogger };
 *
 * const composedHooks = composeHooks(optimizationHooks, telemetryHooks, userHooks);
 * ```
 */
export function composeHooks(...hookSets: (ComposableHooks | undefined)[]): ComposableHooks {
  // Filter out undefined hook sets
  const validHookSets = hookSets.filter((h): h is ComposableHooks => h !== undefined);

  if (validHookSets.length === 0) {
    return {};
  }

  if (validHookSets.length === 1) {
    return validHookSets[0];
  }

  return {
    onToolCall: composeOnToolCall(validHookSets),
    transformResponse: composeTransformResponse(validHookSets),
    onToolError: composeOnToolError(validHookSets),
    transformToolConfig: composeTransformToolConfig(validHookSets),
    onServerCreate: composeOnServerCreate(validHookSets),
  };
}

/**
 * Compose onToolCall hooks - run all in sequence.
 */
function composeOnToolCall(
  hookSets: ComposableHooks[]
): ((toolName: string, params: unknown) => Promise<void>) | undefined {
  const hooks = hookSets
    .map((h) => h.onToolCall)
    .filter((h): h is NonNullable<typeof h> => h !== undefined);

  if (hooks.length === 0) {
    return undefined;
  }

  return async (toolName: string, params: unknown): Promise<void> => {
    for (const hook of hooks) {
      await hook(toolName, params);
    }
  };
}

/**
 * Compose transformResponse hooks - pipeline each through the next.
 */
function composeTransformResponse(
  hookSets: ComposableHooks[]
): ((toolName: string, result: unknown, params?: unknown) => Promise<unknown>) | undefined {
  const hooks = hookSets
    .map((h) => h.transformResponse)
    .filter((h): h is NonNullable<typeof h> => h !== undefined);

  if (hooks.length === 0) {
    return undefined;
  }

  return async (toolName: string, result: unknown, params?: unknown): Promise<unknown> => {
    let transformed = result;
    for (const hook of hooks) {
      transformed = await hook(toolName, transformed, params);
    }
    return transformed;
  };
}

/**
 * Compose onToolError hooks - run all in sequence.
 */
function composeOnToolError(
  hookSets: ComposableHooks[]
): ((toolName: string, error: Error) => Promise<void>) | undefined {
  const hooks = hookSets
    .map((h) => h.onToolError)
    .filter((h): h is NonNullable<typeof h> => h !== undefined);

  if (hooks.length === 0) {
    return undefined;
  }

  return async (toolName: string, error: Error): Promise<void> => {
    for (const hook of hooks) {
      await hook(toolName, error);
    }
  };
}

/**
 * Compose transformToolConfig hooks - pipeline each through the next.
 */
function composeTransformToolConfig(
  hookSets: ComposableHooks[]
): ((toolName: string, config: unknown) => unknown) | undefined {
  const hooks = hookSets
    .map((h) => h.transformToolConfig)
    .filter((h): h is NonNullable<typeof h> => h !== undefined);

  if (hooks.length === 0) {
    return undefined;
  }

  return (toolName: string, config: unknown): unknown => {
    let transformed = config;
    for (const hook of hooks) {
      transformed = hook(toolName, transformed);
    }
    return transformed;
  };
}

/**
 * Compose onServerCreate hooks - run all in sequence.
 */
function composeOnServerCreate(
  hookSets: ComposableHooks[]
): ((server: McpServer) => Promise<void>) | undefined {
  const hooks = hookSets
    .map((h) => h.onServerCreate)
    .filter((h): h is NonNullable<typeof h> => h !== undefined);

  if (hooks.length === 0) {
    return undefined;
  }

  return async (server: McpServer): Promise<void> => {
    for (const hook of hooks) {
      await hook(server);
    }
  };
}

/**
 * Create hooks that wrap tool calls with pre/post processing.
 *
 * @param options - Wrapper options
 * @returns Hook set
 */
export function createWrapperHooks(options: {
  before?: (toolName: string, params: unknown) => Promise<void>;
  after?: (toolName: string, result: unknown, params: unknown) => Promise<unknown>;
  onError?: (toolName: string, error: Error, params: unknown) => Promise<void>;
}): ComposableHooks {
  return {
    onToolCall: options.before,
    transformResponse: options.after
      ? (toolName, result, params) => options.after!(toolName, result, params)
      : undefined,
    onToolError: options.onError
      ? (_toolName, _error) => {
          // Note: We don't have params in onToolError signature
          // This is a limitation we may want to address later
          return Promise.resolve();
        }
      : undefined,
  };
}
