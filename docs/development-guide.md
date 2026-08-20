# Development Guide

This guide walks through adding tools to existing servers and creating new servers from scratch. All code examples are drawn directly from the codebase — `servers/jira-projects/` serves as the primary reference implementation.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Adding a Tool to an Existing Server](#adding-a-tool-to-an-existing-server)
- [Creating a New Server](#creating-a-new-server)
- [Optimization Layers](#optimization-layers)
- [API Pattern Variations](#api-pattern-variations)
- [Security Patterns](#security-patterns)
- [Quick Reference Checklists](#quick-reference-checklists)

---

## Architecture Overview

### Monorepo Layout

```
atlassian-mcp/
├── packages/
│   ├── shared/           # Shared utilities (TOON formatter, types)
│   └── optimizations/    # startServer(), caching, schema registry, response formatting
├── servers/
│   ├── jira-projects/    # 60 tools — issues, projects, sprints, boards
│   ├── jira-workflows/   # 39 tools — workflows, screens, automation
│   ├── confluence/       # 69 tools — spaces, pages, content
│   └── ...               # 5 more servers (280 tools total)
├── docker/               # Multi-stage Dockerfile
└── docker-compose.yml    # All 8 servers on ports 4001–4008
```

### Build Order

Packages must build before servers because servers depend on them:

```bash
npm run build:packages   # shared → optimizations
npm run build:servers    # all 8 servers in parallel
npm run build:all        # both steps in sequence
```

### Request Flow

Every server follows the same request path:

```
MCP Client (Claude, etc.)
    │
    ▼
MCP Server (server.ts)
    │  registerTool() with hooks
    ▼
Optimization Hooks (packages/optimizations)
    │  onToolCall    → cache check
    │  transformResponse → TOON formatting, caching
    ▼
Tool Handler (tools/*.ts)
    │  Zod parse → API call → response
    ▼
API Client (api/client.ts)
    │  sanitizePath → auth headers → retry/backoff
    ▼
Atlassian REST API
```

The `startServer()` function from `@atlassian-mcp/optimizations` wraps each server's `createServer()` factory, injecting caching, deferred schema loading, and response formatting as hooks — no per-tool configuration needed.

---

## Adding a Tool to an Existing Server

This section walks through adding a tool step-by-step, using `jira-projects` as the target server.

### Step 1: Strict Zod Schema

File: `src/validation/schemas.ts`

Strict schemas validate parameters inside the handler. They use `.strict()` to reject unknown properties and `.describe()` for documentation.

```typescript
// servers/jira-projects/src/validation/schemas.ts

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the project'),
  key: z.string()
    .min(2)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]*$/, 'Project key must start with a letter and contain only uppercase letters and numbers')
    .describe('The project key (2-10 uppercase letters/numbers)'),
  projectTypeKey: z.enum(['business', 'software', 'service_desk'])
    .describe('The type of project to create'),
  description: z.string().optional().describe('The description of the project'),
  leadAccountId: z.string().describe('The account ID of the project lead'),
  // ... more fields
}).strict();
```

Key points:
- **`.strict()`** — Rejects any properties not defined in the schema
- **`.describe()`** — Documents each field; these descriptions appear in the MCP tool schema
- **Regex validators** — Use for constrained formats like project keys
- **`.optional().default()`** — For fields with sensible defaults

### Step 2: MCP Input Schema

File: `src/validation/input-schemas.ts`

MCP input schemas define what the LLM client sees. They use `.passthrough()` instead of `.strict()` to allow the optimization layer to inject extra parameters (like `responseFormat`).

```typescript
// servers/jira-projects/src/validation/input-schemas.ts

export const createProjectInputSchema = z.object({
  name: z.string().min(1).max(80).describe('The name of the project'),
  key: z.string().min(1).max(10).describe('The project key'),
  projectTypeKey: z.enum(['business', 'software', 'service_desk']).describe('The project type'),
  description: z.string().optional().describe('The project description'),
  leadAccountId: z.string().describe('The account ID of the project lead'),
  // ... more fields
}).passthrough();
```

**Why two schemas?** The strict schema catches bad input in the handler. The passthrough schema allows the optimization hooks to add parameters (e.g., `responseFormat: "concise"`) without modifying every input schema.

### Step 3: Tool Handler

File: `src/tools/<category>.ts`

Register tools using `server.registerTool()` with three arguments: name, config, and async handler.

```typescript
// servers/jira-projects/src/tools/issues.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { createIssueSchema } from '../validation/schemas.js';
import { createIssueInputSchema } from '../validation/input-schemas.js';
import { wrapUserContent } from '../utils/sanitize.js';

export async function registerIssueTools(server: McpServer, apiClient: JiraApiClient) {

  server.registerTool(
    'create_issue',
    {
      title: 'Create Issue',
      description: 'Creates a new issue in a Jira project...',
      inputSchema: createIssueInputSchema,       // MCP schema (passthrough)
      annotations: {
        title: 'Create Issue',
        readOnlyHint: false,      // Modifies state
        destructiveHint: false,   // Creating is not destructive
        idempotentHint: false,    // Each call creates a new issue
        openWorldHint: false,     // Operates on known Jira instance
      },
    },
    async (params) => {
      try {
        const validated = createIssueSchema.parse(params);  // Strict validation

        const response = await apiClient.makeRequest({
          method: 'POST',
          path: '/issue',
          data: { fields: { /* ... */ } },
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: response.data,
              usage_guidance: 'Issue created. Use get_issue to retrieve full details.',
              suggested_next_steps: ['get_issue', 'add_comment', 'transition_issue'],
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UNKNOWN_ERROR',
                message: error.message,
                suggestion: error.suggestion || 'Check input parameters and try again',
              },
            }, null, 2),
          }],
        };
      }
    }
  );
}
```

**Annotations are required on every tool:**

| Annotation | Meaning |
|------------|---------|
| `readOnlyHint: true` | Tool only reads data (GET requests) |
| `destructiveHint: true` | Tool deletes or overwrites data |
| `idempotentHint: true` | Calling multiple times has same effect as once |
| `openWorldHint: false` | Operates on known, bounded system |

**Response format:**

Success:
```json
{ "success": true, "data": { ... }, "usage_guidance": "...", "suggested_next_steps": ["..."] }
```

Error:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "...", "suggestion": "..." } }
```

### Step 4: Tool Catalog Entry

File: `src/server.ts`

Add an entry to the `toolCatalog` array. This powers the `search_tools` discovery tool.

```typescript
// servers/jira-projects/src/server.ts

export const toolCatalog = [
  // ... existing entries
  { name: 'create_issue', category: 'issues', type: 'create', description: 'Create a new issue' },
  { name: 'get_issue', category: 'issues', type: 'read', description: 'Get issue details by key/ID' },
  { name: 'delete_issue', category: 'issues', type: 'delete', description: 'Delete an issue permanently' },
];
```

Each entry has:
- **`name`** — Must match the tool registration name exactly
- **`category`** — Grouping for `search_tools` filtering
- **`type`** — One of: `discovery`, `create`, `read`, `update`, `delete`
- **`description`** — Short description for the catalog

### Step 5: Tool Examples (Optional)

File: `src/validation/tool-examples.ts`

For tools with complex inputs (custom fields, nested objects), add examples to improve LLM accuracy:

```typescript
// servers/jira-projects/src/validation/tool-examples.ts

import type { ToolInputExample } from '@atlassian-mcp/optimizations/tools';

export const toolExamples: Record<string, ToolInputExample[]> = {
  create_issue: [
    {
      name: 'Create a bug with priority and labels',
      input: {
        projectKey: 'PROJ',
        issueType: 'Bug',
        summary: 'Login page returns 500 error on mobile Safari',
        priority: 'High',
        labels: ['mobile', 'login'],
      },
    },
  ],
};
```

Reference examples in the tool config: `examples: toolExamples['create_issue']`

### Step 6: Build and Validate

```bash
cd servers/jira-projects
npm run build                     # Build the server

cd ../..
npm run generate:tool-catalog     # Regenerate docs/tool-catalog.md and schemas/tools.json
npm run validate:all              # Full validation (tool catalog + skill dependencies)
```

---

## Creating a New Server

This section walks through creating a complete new server. We use "bitbucket" as an example name.

### Step 1: Directory Structure

Every server follows this canonical layout:

```
servers/bitbucket/
├── src/
│   ├── api/
│   │   └── client.ts           # API client with retry/pooling
│   ├── auth/
│   │   └── index.ts            # Authentication manager
│   ├── tools/
│   │   └── repositories.ts     # Tool registrations (one file per category)
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── utils/
│   │   ├── errors.ts           # Error classes and mapping
│   │   ├── logger.ts           # Winston logger
│   │   └── sanitize.ts         # Prompt injection defense
│   ├── validation/
│   │   ├── schemas.ts          # Strict Zod schemas
│   │   └── input-schemas.ts    # MCP input schemas (.passthrough)
│   ├── index.ts                # Entry point
│   └── server.ts               # Factory, hooks, tool catalog
├── build.mjs                   # esbuild + tsc declarations
├── package.json
└── tsconfig.json
```

### Step 2: package.json

```json
{
  "name": "bitbucket-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for Bitbucket repository management",
  "main": "dist/index.js",
  "type": "module",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./exports": {
      "import": "./dist/exports.js",
      "types": "./dist/exports.d.ts"
    }
  },
  "scripts": {
    "build": "node build.mjs",
    "build:fast": "cross-env SKIP_DECLARATIONS=true node build.mjs",
    "dev": "tsx --watch src/index.ts",
    "start": "node dist/index.js",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "@atlassian-mcp/optimizations": "*",
    "@atlassian-mcp/shared": "*",
    "@modelcontextprotocol/sdk": "^1.25.1",
    "axios": "^1.6.0",
    "axios-retry": "^4.0.0",
    "dotenv": "^16.0.0",
    "express": "^4.21.0",
    "lru-cache": "^10.0.0",
    "winston": "^3.11.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "cross-env": "^10.1.0",
    "esbuild": "^0.27.2",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Step 3: tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 4: build.mjs

The build uses esbuild for fast JS transpilation and tsc for type declarations:

```javascript
import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

async function getEntryPoints(dir) {
  const entries = [];
  const files = await readdir(dir);
  for (const file of files) {
    const path = join(dir, file);
    const stats = await stat(path);
    if (stats.isDirectory()) {
      entries.push(...await getEntryPoints(path));
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      entries.push(path);
    }
  }
  return entries;
}

async function build() {
  const entryPoints = await getEntryPoints('./src');

  // Step 1: esbuild for JS output
  await esbuild.build({
    entryPoints,
    outdir: 'dist',
    platform: 'node',
    target: 'node20',
    format: 'esm',
    bundle: false,
    sourcemap: true,
    outExtension: { '.js': '.js' },
    logLevel: 'info',
  });

  // Step 2: tsc for declarations (skippable with SKIP_DECLARATIONS=true)
  if (process.env.SKIP_DECLARATIONS !== 'true') {
    console.log('Generating TypeScript declarations...');
    try {
      execSync('npx cross-env NODE_OPTIONS=--max-old-space-size=8192 tsc -p tsconfig.declarations.json', {
        stdio: 'inherit',
        timeout: 600000,
      });
    } catch {
      console.warn('Warning: Declaration generation failed. JS build is still valid.');
    }
  }

  console.log('Build completed successfully!');
}

build();
```

### Step 5: Entry Point (index.ts)

The entry point is minimal — it delegates everything to `startServer()`:

```typescript
// servers/bitbucket/src/index.ts
#!/usr/bin/env node

import dotenv from 'dotenv';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';
import { startServer } from '@atlassian-mcp/optimizations';

dotenv.config();

async function main() {
  await startServer({
    name: 'bitbucket',
    createBaseServer: createServer,
    enableCaching: true,
    enableSchemaRegistry: true,
    debug: process.env.DEBUG === 'true',
  });
}

main().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
```

### Step 6: Server Factory (server.ts)

The server factory creates the MCP server, initializes the API client, and registers all tools. It uses a hooked tool registrar so the optimization layer can intercept every tool call.

```typescript
// servers/bitbucket/src/server.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import { AuthManager } from './auth/index.js';
import { BitbucketApiClient } from './api/client.js';
import { logger } from './utils/logger.js';
import { registerRepositoryTools } from './tools/repositories.js';

// --- Types ---
export interface ServerHooks {
  onToolCall?: (toolName: string, params: unknown) => Promise<void>;
  transformResponse?: (toolName: string, result: unknown, params?: unknown) => Promise<unknown>;
  onToolError?: (toolName: string, error: Error) => Promise<void>;
  transformToolConfig?: (toolName: string, config: unknown) => unknown;
  onServerCreate?: (server: McpServer) => Promise<void>;
  onClientCreate?: (client: BitbucketApiClient) => Promise<void>;
}

export interface ServerConfig {
  name?: string;
  version?: string;
  hooks?: ServerHooks;
  authConfig?: any;
}

// --- Tool Catalog ---
export const toolCatalog = [
  { name: 'search_repositories', category: 'repositories', type: 'discovery', description: 'Search repositories' },
  { name: 'get_repository', category: 'repositories', type: 'read', description: 'Get repository details' },
  // ... add entries for every tool
  { name: 'search_tools', category: 'meta', type: 'discovery', description: 'Discover available tools' },
];

// --- Hooked Tool Registrar ---
function createHookedToolRegistrar(server: McpServer, hooks: ServerHooks) {
  return {
    registerTool: ((name: string, config: any, handler: (params: any) => Promise<any>) => {
      const transformedConfig = hooks.transformToolConfig
        ? hooks.transformToolConfig(name, config) : config;

      const wrappedHandler = async (params: any) => {
        if (hooks.onToolCall) await hooks.onToolCall(name, params);
        try {
          let result = await handler(params);
          if (hooks.transformResponse) result = await hooks.transformResponse(name, result, params);
          return result;
        } catch (error) {
          if (hooks.onToolError) await hooks.onToolError(name, error as Error);
          throw error;
        }
      };
      server.registerTool(name, transformedConfig, wrappedHandler);
    }) as McpServer['registerTool'],
  };
}

// --- Server Factory ---
export async function createServer(config: ServerConfig = {}) {
  const serverName = config.name || 'bitbucket-mcp-server';
  const server = new McpServer({ name: serverName, version: config.version || '1.0.0' });

  if (config.hooks?.onServerCreate) await config.hooks.onServerCreate(server);

  const authManager = new AuthManager(config.authConfig || {/* env defaults */});
  const apiClient = new BitbucketApiClient(authManager);

  if (config.hooks?.onClientCreate) await config.hooks.onClientCreate(apiClient);

  const boundRegisterTool = config.hooks
    ? createHookedToolRegistrar(server, config.hooks).registerTool
    : server.registerTool.bind(server);

  const registrarServer = new Proxy(server, {
    get(target, prop) {
      if (prop === 'registerTool') return boundRegisterTool;
      return target[prop as keyof typeof target];
    },
  }) as McpServer;

  // Register tool groups
  registerSearchTools(registrarServer);
  await registerRepositoryTools(registrarServer, apiClient);

  // Transport setup (stdio + HTTP)
  const start = async (transport: 'stdio' | 'http' = 'stdio') => { /* ... */ };
  const stop = async () => { /* ... */ };

  return { server, apiClient, start, stop };
}
```

### Step 7: API Client

File: `src/api/client.ts`

The API client handles HTTP communication with connection pooling, retry logic, rate limiting, and path sanitization:

```typescript
// servers/bitbucket/src/api/client.ts

import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import http from 'http';
import https from 'https';
import { LRUCache } from 'lru-cache';
import { AuthManager } from '../auth/index.js';

export class BitbucketApiClient {
  private axios: AxiosInstance;
  private rateLimitInfo: LRUCache<string, any> = new LRUCache({
    max: 100,
    ttl: 1000 * 60 * 5,
  });

  constructor(private authManager: AuthManager) {
    this.axios = axios.create({
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 10 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 10 }),
    });

    axiosRetry(this.axios, {
      retries: parseInt(process.env.MAX_RETRIES || '3'),
      retryDelay: (retryCount) => {
        const delay = parseInt(process.env.RETRY_DELAY || '1000');
        return delay * Math.pow(2, retryCount - 1);
      },
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        (error.response?.status !== undefined && error.response.status >= 500 && error.response.status !== 503),
    });
  }

  // REQUIRED: Path sanitization prevents path traversal attacks
  private sanitizePath(path: string): string {
    return path.split('/').map(segment => {
      if (!segment) return segment;
      if (segment === '.' || segment === '..') {
        throw new Error(`Invalid path segment: ${segment}`);
      }
      if (/^[\w\-.:@~+]+$/.test(segment)) return segment;
      return encodeURIComponent(segment);
    }).join('/');
  }

  async makeRequest<T>(config: {
    method: string;
    path: string;
    params?: Record<string, any>;
    data?: any;
  }) {
    const authHeaders = this.authManager.getAuthHeaders();
    const baseURL = `${this.authManager.getBaseUrl()}/2.0`;

    const response = await this.axios.request<T>({
      method: config.method,
      url: this.sanitizePath(config.path),
      baseURL,
      params: config.params,
      data: config.data,
      headers: authHeaders,
    });

    return { success: true, data: response.data };
  }
}
```

### Step 8: Auth Manager

File: `src/auth/index.ts`

```typescript
// servers/bitbucket/src/auth/index.ts

export class AuthManager {
  constructor(private config: { baseUrl?: string; email?: string; apiToken?: string }) {
    this.config = {
      baseUrl: config.baseUrl || process.env.ATLASSIAN_SITE_URL || '',
      email: config.email || process.env.ATLASSIAN_USER_EMAIL,
      apiToken: config.apiToken || process.env.ATLASSIAN_API_TOKEN,
    };
  }

  getAuthHeaders(): Record<string, string> {
    if (!this.config.email || !this.config.apiToken) {
      throw new Error('Email and API token are required');
    }
    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
  }

  getBaseUrl(): string {
    return (this.config.baseUrl || '').replace(/\/$/, '');
  }
}
```

### Step 9: Error Utilities

File: `src/utils/errors.ts`

Every server needs an error hierarchy with sanitization to prevent leaking internal details:

```typescript
// servers/bitbucket/src/utils/errors.ts

// Sanitize error messages — strip stack traces, file paths, tokens
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'An error occurred';
  let sanitized = message;
  sanitized = sanitized.replace(/\s+at\s+.+/g, '');              // Stack traces
  sanitized = sanitized.replace(/[A-Za-z]:\\[^\s:]+/g, '[path]'); // Windows paths
  sanitized = sanitized.replace(/\/[^\s:]+\.(ts|js|json)/g, '[path]'); // Unix paths
  if (sanitized.length > 500) sanitized = sanitized.substring(0, 497) + '...';
  return sanitized.replace(/\s+/g, ' ').trim() || 'An error occurred';
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
    public suggestion?: string
  ) {
    super(sanitizeErrorMessage(message));
    this.name = 'ApiError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication failed') {
    super('AUTH_ERROR', message, undefined, 'Check your API credentials');
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, details, 'Check input parameters');
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, identifier: string) {
    super('NOT_FOUND', `${resource} '${identifier}' not found`, { resource, identifier });
  }
}

// Map HTTP status codes to error classes
export function mapAtlassianError(statusCode: number, responseBody?: any): ApiError {
  const errorMessage = /* extract from responseBody */;
  switch (statusCode) {
    case 400: return new ValidationError(errorMessage);
    case 401: return new AuthenticationError(errorMessage);
    case 404: return new NotFoundError('resource', errorMessage);
    case 429: return new ApiError('RATE_LIMIT', 'Rate limit exceeded');
    default:  return new ApiError(`HTTP_${statusCode}`, errorMessage);
  }
}
```

### Step 10: User Content Sanitization

File: `src/utils/sanitize.ts`

Wrap user-generated content with boundary markers to defend against prompt injection:

```typescript
// servers/bitbucket/src/utils/sanitize.ts

const CONTENT_BOUNDARY_START = '===USER_CONTENT_START===';
const CONTENT_BOUNDARY_END = '===USER_CONTENT_END===';
const MAX_CONTENT_LENGTH = 10000;

export function wrapUserContent(content: unknown): string | null {
  if (content === null || content === undefined) return null;
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  const truncated = str.length > MAX_CONTENT_LENGTH
    ? str.slice(0, MAX_CONTENT_LENGTH) + '...[TRUNCATED]'
    : str;
  return `${CONTENT_BOUNDARY_START}\n${truncated}\n${CONTENT_BOUNDARY_END}`;
}

// Apply to known user content fields
const USER_CONTENT_FIELDS = new Set(['description', 'summary', 'body', 'content']);

export function sanitizeUserFields<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const field of USER_CONTENT_FIELDS) {
    if (field in result && result[field] != null) {
      (result as Record<string, unknown>)[field] = wrapUserContent(result[field]);
    }
  }
  return result;
}
```

### Step 11: Register with Workspace

Add the new server to the root `package.json` workspaces. This happens automatically because the root config uses a glob:

```json
{
  "workspaces": [
    "packages/*",
    "servers/*"
  ]
}
```

After creating the directory, run `npm install` from the repo root to link workspace dependencies.

### Step 12: Docker Integration

Add a service to `docker-compose.yml` using the next available port:

```yaml
# docker-compose.yml

  bitbucket:
    build:
      context: .
      dockerfile: docker/Dockerfile
      args:
        SERVER: bitbucket
    container_name: bitbucket-mcp
    environment:
      - TRANSPORT=http
      - MCP_PORT=3000
      - SERVER_NAME=bitbucket
      - DEBUG=${DEBUG:-false}
      - ATLASSIAN_SITE_URL=${ATLASSIAN_SITE_URL}
      - ATLASSIAN_USER_EMAIL=${ATLASSIAN_USER_EMAIL}
      - ATLASSIAN_API_TOKEN=${ATLASSIAN_API_TOKEN}
    ports:
      - "127.0.0.1:4009:3000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

The existing `docker/Dockerfile` is parameterized with `ARG SERVER` — it builds any server without modification:

```dockerfile
ARG SERVER=jira-projects
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY servers/ ./servers/
RUN npm ci
# Build packages first, then all servers
WORKDIR /app/packages/shared
RUN npm run build
WORKDIR /app/packages/optimizations
RUN npm run build
WORKDIR /app
RUN npm run build --workspaces --if-present
```

### Step 13: Build and Validate

```bash
npm install                       # Link workspace dependencies
cd servers/bitbucket && npm run build   # Build new server
cd ../..
npm run generate:tool-catalog     # Update tool catalog
npm run validate:all              # Full validation
```

---

## Optimization Layers

When you call `startServer()` from `@atlassian-mcp/optimizations`, four capabilities are automatically wired in via hooks. No per-tool configuration is needed.

### Response Caching

- LRU cache on GET-like tool calls (read-only tools based on `readOnlyHint: true`)
- Write-through invalidation: when a write tool runs, related cache entries are evicted
- Configurable TTL via `cacheConfig` in `startServer()` options
- Debug with `DEBUG_CACHE=true` environment variable

### Deferred Schema Loading

- Registers a `load_tool_schema` meta-tool on every server
- On initial connection, clients receive lightweight tool stubs (name + description only)
- Full Zod schemas are sent on-demand when the client calls `load_tool_schema`
- Reduces initial payload by 60–75%

### Response Formatting

The formatter is **fully data-driven** — it requires zero configuration per tool:

1. **Extract** — Finds the primary data array in any tool response by scanning for the largest array of objects
2. **Detect fields** — Inspects array items to discover scalar fields, ranked by usefulness:
   - Tier 1: `id`, `key` (identifiers)
   - Tier 2: `name`, `title`, `summary` (labels)
   - Tier 3: `type`, `status`, `category` (classification)
   - Tier 4+: remaining scalar fields alphabetically
3. **Format** — Converts to TOON (Tab-Organized Object Notation) for ~50–60% token reduction
4. **Preserve metadata** — Appends `success`, `pagination`, `usage_guidance` after the formatted output

Format levels (auto-injected as `responseFormat` parameter):

| Format | Fields shown | Use case |
|--------|-------------|----------|
| `concise` (default) | Top 4 | List discovery, quick scans |
| `standard` | Top 8 | Detailed exploration |
| `detailed` | All (passthrough JSON) | Full data, no transformation |

### search_tools

Every server automatically gets a `search_tools` tool powered by the `toolCatalog` array in `server.ts`. Clients call it to discover available tools by category or operation type before invoking them.

---

## API Pattern Variations

The eight servers use three different API patterns. Understanding which pattern applies helps when adding tools.

### Standard Jira REST (Most Servers)

Used by: `jira-projects`, `jira-workflows`, `jira-fields-permissions`, `jira-service-desk`, `jira-organization`, `jira-system-admin`

Single `makeRequest()` method with a configurable `apiBase` (defaults to `/rest/api/3`):

```typescript
const response = await apiClient.makeRequest({
  method: 'GET',
  path: `/project/${projectKey}`,
  // apiBase defaults to '/rest/api/3'
});

// Agile endpoints use a different base:
const sprints = await apiClient.makeRequest({
  method: 'GET',
  path: `/board/${boardId}/sprint`,
  apiBase: '/rest/agile/1.0',
});
```

### Multi-Version REST (Confluence)

Used by: `confluence`

Two base URLs for the v1 (legacy) and v2 (newer) APIs:

```typescript
// V2 API (default) — /wiki/api/v2
const page = await apiClient.makeRequest({
  method: 'GET',
  path: `/pages/${pageId}`,
  apiVersion: 'v2',
});

// V1 API (legacy) — /wiki/rest/api
const content = await apiClient.makeRequest({
  method: 'GET',
  path: `/content/${contentId}`,
  apiVersion: 'v1',
});
```

### GraphQL Hybrid (Jira Product Discovery)

Used by: `jira-product-discovery`

Standard REST for ideas (which are Jira issues) plus a GraphQL client for JPD-specific features like insights:

```typescript
// REST for ideas (standard Jira API)
const ideas = await apiClient.makeRequest({
  method: 'POST',
  path: '/search/jql',
  data: { jql: 'project = JPD ORDER BY created DESC' },
});

// GraphQL for insights (Polaris API)
const insights = await graphqlClient.request(GET_INSIGHTS_QUERY, {
  projectAri: `ari:cloud:jira:${cloudId}:project/${projectId}`,
});
```

Key differences:
- GraphQL endpoint: `https://api.atlassian.com/graphql`
- Required header: `X-ExperimentalApi: polaris-v0`
- Uses Atlassian Resource Identifiers (ARIs) instead of numeric IDs

---

## Security Patterns

Every server must implement these four security layers. They are not optional.

### Input Validation

Every tool handler must call `.parse()` with the strict schema before using parameters:

```typescript
async (params) => {
  const validated = createProjectSchema.parse(params);  // Throws on invalid input
  // Only use 'validated', never raw 'params'
}
```

### Path Sanitization

The API client's `sanitizePath()` method prevents path traversal attacks. It rejects `..` and `.` segments and encodes special characters:

```typescript
private sanitizePath(path: string): string {
  return path.split('/').map(segment => {
    if (!segment) return segment;
    if (segment === '.' || segment === '..') {
      throw new Error(`Invalid path segment: ${segment}`);
    }
    if (/^[\w\-.:@~+]+$/.test(segment)) return segment;
    return encodeURIComponent(segment);
  }).join('/');
}
```

### Error Sanitization

Error messages are sanitized before reaching the client. Stack traces, file paths, and tokens are stripped:

```typescript
sanitizeErrorMessage(message);   // Strips paths, stack traces, truncates to 500 chars
sanitizeErrorDetails(details);   // Removes keys matching 'password', 'token', 'secret', etc.
```

### User Content Boundaries

User-generated fields (description, summary, body, comments) are wrapped with boundary markers before being returned. This defends against prompt injection by clearly delineating untrusted content:

```typescript
import { wrapUserContent, sanitizeUserFields } from '../utils/sanitize.js';

// Wrap individual field
const safeDescription = wrapUserContent(issue.fields.description);
// Result: "===USER_CONTENT_START===\n<content>\n===USER_CONTENT_END==="

// Wrap all known user fields in an object
const safeIssue = sanitizeUserFields(issue.fields);
```

---

## Quick Reference Checklists

### Add a Tool

- [ ] Add strict Zod schema in `src/validation/schemas.ts` (`.strict()`)
- [ ] Add MCP input schema in `src/validation/input-schemas.ts` (`.passthrough()`)
- [ ] Implement handler in `src/tools/<category>.ts` with `server.registerTool()`
- [ ] Set all 4 annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
- [ ] Add entry to `toolCatalog` in `src/server.ts`
- [ ] Add tool examples in `src/validation/tool-examples.ts` (optional, recommended for complex inputs)
- [ ] Run `npm run build` in the server directory
- [ ] Run `npm run validate:all` from the repo root

### Create a Server

- [ ] Create directory under `servers/` with canonical layout
- [ ] Write `package.json` with workspace dependencies (`@atlassian-mcp/optimizations`, `@atlassian-mcp/shared`)
- [ ] Write `tsconfig.json` (ES2022, strict, bundler resolution)
- [ ] Write `build.mjs` (esbuild for JS, tsc for declarations)
- [ ] Write `src/index.ts` entry point calling `startServer()`
- [ ] Write `src/server.ts` with factory, hooks, tool catalog, transport
- [ ] Write `src/api/client.ts` with connection pooling, retry, `sanitizePath()`
- [ ] Write `src/auth/index.ts` with `getAuthHeaders()`, `getBaseUrl()`
- [ ] Write `src/utils/errors.ts` with error hierarchy and sanitization
- [ ] Write `src/utils/sanitize.ts` with `wrapUserContent()` for prompt injection defense
- [ ] Add service to `docker-compose.yml` with next port (4009+)
- [ ] Run `npm install` from repo root to link workspace
- [ ] Run `npm run build` in the server directory
- [ ] Run `npm run validate:all` from the repo root
