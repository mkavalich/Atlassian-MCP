# MCP Server Remediation Templates

## Overview

This document provides fix patterns for common security vulnerabilities found in MCP server implementations. Each section includes before/after code examples and implementation guidance.

---

## 1. Input Validation Fixes

### 1.1 Add Strict Schema Validation

**Before (Vulnerable):**
```typescript
const inputSchema = z.object({
  query: z.string(),
  limit: z.number().optional()
});
```

**After (Secure):**
```typescript
const inputSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .max(500, 'Query too long')
    .trim()
    .refine(val => !val.includes('..'), 'Invalid characters'),
  limit: z.number()
    .int('Must be an integer')
    .min(1, 'Minimum limit is 1')
    .max(100, 'Maximum limit is 100')
    .default(20)
}).strict();  // Reject unknown properties
```

---

### 1.2 Sanitize Path Inputs

**Before (Vulnerable):**
```typescript
async function readFile(filename: string): Promise<string> {
  const filePath = path.join('./data', filename);
  return fs.readFileSync(filePath, 'utf-8');
}
```

**After (Secure):**
```typescript
import path from 'path';

const ALLOWED_DIR = path.resolve('./data');

async function readFile(filename: string): Promise<string> {
  // Remove any path components
  const safeName = path.basename(filename);
  
  // Validate extension if needed
  const allowedExtensions = ['.json', '.txt', '.csv'];
  const ext = path.extname(safeName).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new ValidationError('Invalid file type');
  }
  
  // Resolve and verify path
  const filePath = path.resolve(ALLOWED_DIR, safeName);
  if (!filePath.startsWith(ALLOWED_DIR)) {
    throw new ValidationError('Invalid file path');
  }
  
  return fs.readFileSync(filePath, 'utf-8');
}
```

---

### 1.3 Parameterize SQL Queries

**Before (Vulnerable):**
```typescript
async function searchUsers(name: string): Promise<User[]> {
  const query = `SELECT * FROM users WHERE name LIKE '%${name}%'`;
  return db.query(query);
}
```

**After (Secure):**
```typescript
async function searchUsers(name: string): Promise<User[]> {
  const query = 'SELECT * FROM users WHERE name LIKE $1';
  const pattern = `%${name.replace(/[%_]/g, '\\$&')}%`;  // Escape wildcards
  return db.query(query, [pattern]);
}
```

---

### 1.4 Escape Shell Arguments

**Before (Vulnerable):**
```typescript
import { exec } from 'child_process';

async function gitLog(author: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`git log --author="${author}"`, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}
```

**After (Secure):**
```typescript
import { execFile } from 'child_process';

async function gitLog(author: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['log', '--author', author], (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}
```

---

## 2. Authentication Fixes

### 2.1 Environment-Based Credentials

**Before (Vulnerable):**
```typescript
const config = {
  apiKey: 'sk-1234567890abcdef',
  baseUrl: 'https://api.example.com'
};
```

**After (Secure):**
```typescript
// config.ts
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  apiKey: getRequiredEnv('API_KEY'),
  baseUrl: getOptionalEnv('API_BASE_URL', 'https://api.example.com')
};

// .env.example (commit this)
# API_KEY=your-api-key-here
# API_BASE_URL=https://api.example.com

// .gitignore (ensure .env is ignored)
.env
.env.local
.env.*.local
```

---

### 2.2 Secure Token Storage

**Before (Vulnerable):**
```typescript
class AuthManager {
  private token: string;
  
  async authenticate(): Promise<void> {
    console.log(`Authenticating with token: ${this.token}`);
    // ...
  }
}
```

**After (Secure):**
```typescript
class AuthManager {
  private token: string | null = null;
  
  async authenticate(): Promise<void> {
    const token = process.env.AUTH_TOKEN;
    if (!token) {
      throw new AuthError('AUTH_TOKEN not configured');
    }
    
    // Never log the actual token
    console.log('Authentication initiated');
    
    try {
      const result = await this.validateToken(token);
      this.token = token;
      console.log('Authentication successful');
    } catch (error) {
      console.error('Authentication failed');
      throw new AuthError('Authentication failed');  // Generic message
    }
  }
  
  getAuthHeader(): Record<string, string> {
    if (!this.token) {
      throw new AuthError('Not authenticated');
    }
    return { 'Authorization': `Bearer ${this.token}` };
  }
}
```

---

### 2.3 Generic Auth Error Messages

**Before (Vulnerable):**
```typescript
async function login(username: string, password: string) {
  const user = await db.findUser(username);
  if (!user) {
    throw new Error('User not found');  // Reveals valid usernames
  }
  if (!await bcrypt.compare(password, user.passwordHash)) {
    throw new Error('Invalid password');  // Different error message
  }
  return generateToken(user);
}
```

**After (Secure):**
```typescript
async function login(username: string, password: string) {
  // Constant time comparison
  const user = await db.findUser(username);
  
  // Always do password check even if user doesn't exist
  // Prevents timing attacks
  const dummyHash = '$2b$10$dummy.hash.for.timing.attack.prevention';
  const hashToCheck = user?.passwordHash || dummyHash;
  
  const passwordValid = await bcrypt.compare(password, hashToCheck);
  
  if (!user || !passwordValid) {
    // Same error for all auth failures
    throw new AuthError('Invalid credentials');
  }
  
  return generateToken(user);
}
```

---

## 3. Error Handling Fixes

### 3.1 Sanitize Error Responses

**Before (Vulnerable):**
```typescript
catch (error) {
  return {
    isError: true,
    content: [{ type: 'text', text: error.stack }]
  };
}
```

**After (Secure):**
```typescript
// errors/sanitizer.ts
export function sanitizeError(error: unknown): string {
  if (error instanceof ValidationError) {
    return `Validation failed: ${error.message}`;
  }
  if (error instanceof NotFoundError) {
    return error.message;  // Safe user-facing messages
  }
  if (error instanceof RateLimitError) {
    return `Rate limited. Retry after ${error.retryAfter} seconds.`;
  }
  
  // Log full error internally
  console.error('Unhandled error:', error);
  
  // Return generic message externally
  return 'An unexpected error occurred. Please try again.';
}

// In tool handler
catch (error) {
  return {
    isError: true,
    content: [{ type: 'text', text: sanitizeError(error) }]
  };
}
```

---

### 3.2 Create Custom Error Classes

```typescript
// errors/index.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class RateLimitError extends AppError {
  constructor(public readonly retryAfter: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', 429);
  }
}

// Error handler
export function handleError(error: unknown): { message: string; code: string } {
  if (error instanceof AppError && error.isOperational) {
    return { message: error.message, code: error.code };
  }
  
  // Log unexpected errors
  console.error('Unexpected error:', error);
  
  return { message: 'Internal error', code: 'INTERNAL_ERROR' };
}
```

---

## 4. MCP-Specific Fixes

### 4.1 Accurate Tool Annotations

**Before (Incorrect):**
```typescript
server.registerTool({
  name: 'delete_project',
  description: 'Delete a project permanently',
  inputSchema: deleteProjectSchema,
  annotations: {
    readOnlyHint: true,      // WRONG
    destructiveHint: false   // WRONG
  },
  handler: deleteProjectHandler
});
```

**After (Correct):**
```typescript
server.registerTool({
  name: 'delete_project',
  description: 'Delete a project permanently. This action cannot be undone.',
  inputSchema: deleteProjectSchema,
  annotations: {
    readOnlyHint: false,      // Correct: modifies data
    destructiveHint: true,    // Correct: deletes data
    idempotentHint: true,     // Correct: deleting twice has same effect
    openWorldHint: false      // Correct: operates on known project
  },
  handler: deleteProjectHandler
});
```

**Annotation Guide:**
| Operation Type | readOnlyHint | destructiveHint | idempotentHint |
|---------------|--------------|-----------------|----------------|
| GET/Search    | true         | false           | true           |
| CREATE        | false        | false           | false          |
| UPDATE        | false        | false           | true           |
| DELETE        | false        | true            | true           |

---

### 4.2 Sanitize User Data in Responses

**Before (Vulnerable):**
```typescript
async function getComments(issueId: string) {
  const comments = await api.getComments(issueId);
  return {
    content: [{
      type: 'text',
      text: comments.map(c => `${c.author}: ${c.body}`).join('\n')
    }]
  };
}
```

**After (Secure):**
```typescript
async function getComments(issueId: string) {
  const comments = await api.getComments(issueId);
  
  // Return structured data to prevent prompt injection
  const sanitizedComments = comments.map(c => ({
    id: c.id,
    author: c.author.displayName,
    created: c.created,
    // Truncate and escape body
    body: c.body.substring(0, 1000)
  }));
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(sanitizedComments, null, 2)
    }]
  };
}
```

---

### 4.3 Filter Sensitive Data from Responses

**Before (Leaky):**
```typescript
async function getConfig() {
  const config = await api.getSystemConfig();
  return {
    content: [{ type: 'text', text: JSON.stringify(config) }]
  };
}
```

**After (Secure):**
```typescript
// Define allowlist of safe fields
const SAFE_CONFIG_FIELDS = [
  'serverName', 'version', 'timezone', 'locale', 
  'maxResults', 'features'
];

async function getConfig() {
  const config = await api.getSystemConfig();
  
  // Filter to safe fields only
  const safeConfig = Object.fromEntries(
    Object.entries(config).filter(([key]) => 
      SAFE_CONFIG_FIELDS.includes(key)
    )
  );
  
  return {
    content: [{ type: 'text', text: JSON.stringify(safeConfig, null, 2) }]
  };
}
```

---

## 5. Rate Limiting Fixes

### 5.1 Add Rate Limit Handling

**Before (Missing):**
```typescript
async function fetchData(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}
```

**After (Implemented):**
```typescript
interface RateLimitState {
  limited: boolean;
  retryAfter: number;
  resetAt: Date | null;
}

class ApiClient {
  private rateLimitState: RateLimitState = {
    limited: false,
    retryAfter: 0,
    resetAt: null
  };
  
  async fetchData(url: string, retryCount = 0): Promise<any> {
    const MAX_RETRIES = 3;
    
    // Check if currently rate limited
    if (this.rateLimitState.limited) {
      const waitTime = this.rateLimitState.resetAt 
        ? this.rateLimitState.resetAt.getTime() - Date.now()
        : this.rateLimitState.retryAfter * 1000;
      
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
      this.rateLimitState.limited = false;
    }
    
    const response = await fetch(url);
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      
      this.rateLimitState = {
        limited: true,
        retryAfter,
        resetAt: new Date(Date.now() + retryAfter * 1000)
      };
      
      if (retryCount < MAX_RETRIES) {
        console.log(`Rate limited. Retrying after ${retryAfter}s...`);
        await this.sleep(retryAfter * 1000);
        return this.fetchData(url, retryCount + 1);
      }
      
      throw new RateLimitError(retryAfter);
    }
    
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    
    return response.json();
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 6. Container Security Fixes

### 6.1 Non-Root User

**Before (Vulnerable):**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "dist/index.js"]
```

**After (Secure):**
```dockerfile
FROM node:18-alpine

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package files and install dependencies as root
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY --chown=appuser:appgroup . .

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

CMD ["node", "dist/index.js"]
```

---

### 6.2 Multi-Stage Build

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Security updates
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built files from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

---

## 7. Logging Fixes

### 7.1 Sanitized Logging

**Before (Leaky):**
```typescript
logger.info('Request received', { headers: request.headers });
logger.debug('API call', { url, apiKey });
```

**After (Secure):**
```typescript
// utils/logger.ts
const SENSITIVE_KEYS = [
  'authorization', 'x-api-key', 'apikey', 'password', 
  'secret', 'token', 'cookie', 'session'
];

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function logSafe(level: string, message: string, data?: any) {
  const sanitized = data ? sanitizeObject(data) : undefined;
  console[level](message, sanitized);
}

// Usage
logSafe('info', 'Request received', { headers: request.headers });
// Output: Request received { headers: { authorization: '[REDACTED]', ... } }
```

---

## Quick Fix Checklist

When remediating vulnerabilities, follow this order:

1. **Critical/High Priority**
   - [ ] Remove hardcoded credentials
   - [ ] Add input validation with strict schemas
   - [ ] Fix injection vulnerabilities (SQL, command, path)
   - [ ] Implement rate limit handling
   - [ ] Add non-root user to Dockerfile

2. **Medium Priority**
   - [ ] Sanitize error messages
   - [ ] Add accurate tool annotations
   - [ ] Filter sensitive data from responses
   - [ ] Implement secure logging

3. **Low Priority**
   - [ ] Add correlation IDs to errors
   - [ ] Implement health checks
   - [ ] Configure log rotation
   - [ ] Add multi-stage Docker builds

4. **Verification**
   - [ ] Run `npm audit` and fix vulnerabilities
   - [ ] Run static analysis tools
   - [ ] Test with malicious inputs
   - [ ] Review logs for sensitive data
