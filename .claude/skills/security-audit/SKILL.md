---
name: security-audit
description: Comprehensive security audit framework for MCP servers based on Model Context Protocol Security initiative best practices. Use this skill to systematically evaluate MCP server implementations for vulnerabilities, compliance issues, and security risks.
license: Complete terms in LICENSE.txt
---

# MCP Server Security Audit Guide

## Overview

This skill provides a systematic approach to auditing MCP (Model Context Protocol) servers for security vulnerabilities, compliance issues, and operational risks. Based on the Model Context Protocol Security initiative and industry best practices.

**When to use this skill:**
- Before deploying MCP servers to production
- During periodic security reviews
- After significant code changes
- When onboarding new MCP servers
- For compliance documentation

---

# Audit Process

## High-Level Workflow

Security auditing an MCP server involves four phases:

### Phase 1: Repository Assessment

#### 1.1 Provenance Verification

**Check repository integrity:**
- Verify commit history for suspicious patterns
- Review contributor access and permissions
- Check for signed commits where applicable
- Verify package publishing integrity (npm, PyPI)

**Commands to run:**
```bash
# Check recent commit authors
git log --format='%an <%ae>' | sort -u

# Look for force pushes or history rewrites
git reflog show --all | head -50

# Check for unsigned commits (if signing is expected)
git log --show-signature -5
```

#### 1.2 Dependency Analysis

**Scan for vulnerable dependencies:**
```bash
# Node.js projects
npm audit
npm audit --json > audit-report.json

# Check for outdated packages
npm outdated

# Python projects
pip-audit
safety check
```

**Review dependency tree for:**
- Known CVEs (check against NVD, Snyk, GitHub Advisory)
- Unmaintained packages (no updates >2 years)
- Excessive transitive dependencies
- Packages with low download counts (supply chain risk)

#### 1.3 Code Quality Assessment

**Static analysis:**
```bash
# TypeScript/JavaScript
npx eslint . --ext .ts,.js
npx tsc --noEmit

# Check for hardcoded secrets
npx secretlint "**/*"

# Look for TODO/FIXME security items
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" src/
```

**Review test coverage:**
- Unit tests for input validation
- Integration tests for auth flows
- Error handling test cases

---

### Phase 2: Code Security Review

#### 2.1 Input Validation Audit

**Check all tool input schemas:**

Reference: [Input Validation Checklist](./reference/security-checklist.md#input-validation)

**Verification steps:**
1. List all tools and their input schemas
2. Verify Zod/Pydantic schemas use `.strict()` mode
3. Check for injection vectors in string inputs
4. Verify numeric bounds and type coercion
5. Test edge cases (empty, null, oversized inputs)

**Pattern to search for:**
```typescript
// GOOD: Strict schema with constraints
z.object({
  projectKey: z.string().min(1).max(10).regex(/^[A-Z][A-Z0-9]*$/),
  maxResults: z.number().int().min(1).max(100).default(20)
}).strict()

// BAD: Loose schema without constraints
z.object({
  query: z.string()  // No length limit, no sanitization
})
```

#### 2.2 Authentication & Authorization Audit

**Review credential handling:**

Reference: [Auth Security Patterns](./reference/vulnerability-patterns.md#authentication)

**Check for:**
- [ ] Credentials loaded from environment variables (not hardcoded)
- [ ] API tokens never logged or included in error messages
- [ ] OAuth tokens properly scoped and refreshed
- [ ] Service accounts use least privilege
- [ ] Auth failures return generic errors (prevent enumeration)

**Files to review:**
- `src/auth/*.ts` - Authentication managers
- `src/api/client.ts` - API client credential usage
- `.env.example` - Document required credentials
- `docker-compose.yml` - Environment variable injection

#### 2.3 Error Handling Audit

**Verify secure error handling:**

Reference: [Error Handling Patterns](./reference/vulnerability-patterns.md#error-handling)

**Check for:**
- [ ] Errors sanitized before returning to client
- [ ] Stack traces not exposed in production
- [ ] Sensitive data stripped from error context
- [ ] Rate limit errors don't leak timing info
- [ ] Auth errors are generic (prevent enumeration)

**Pattern to verify:**
```typescript
// GOOD: Sanitized error response
catch (error) {
  return {
    isError: true,
    content: [{ type: "text", text: "Operation failed: " + sanitizeError(error) }]
  };
}

// BAD: Raw error exposure
catch (error) {
  return {
    isError: true,
    content: [{ type: "text", text: error.stack }]  // Leaks internals
  };
}
```

#### 2.4 Data Protection Audit

**Review sensitive data handling:**
- [ ] PII handling complies with data protection requirements
- [ ] Sensitive fields masked in logs
- [ ] No sensitive data in tool responses without explicit request
- [ ] Temporary files securely deleted
- [ ] Memory cleared after processing secrets

---

### Phase 3: MCP-Specific Security Checks

#### 3.1 Tool Poisoning Prevention

**What is tool poisoning?**
Malicious modification of tool definitions to alter LLM behavior, inject prompts, or exfiltrate data.

**Verification:**
- [ ] Tool descriptions don't contain hidden instructions
- [ ] Tool schemas accurately reflect actual behavior
- [ ] No dynamic tool generation from untrusted sources
- [ ] Tool annotations (`readOnlyHint`, `destructiveHint`) are accurate

**Review tool definitions:**
```typescript
// Check that annotations match actual behavior
{
  name: "delete_project",
  annotations: {
    destructiveHint: true,  // Must be true for destructive ops
    readOnlyHint: false
  }
}
```

#### 3.2 Prompt Injection Prevention (CRITICAL)

**Why this matters for MCP servers:**
Every tool response flows back into the LLM's context. When your server returns user-generated content from Jira issues, Confluence pages, or comments, that content can contain malicious instructions the LLM may follow.

**Reference:** [Prompt Injection Security Guide](./reference/prompt-injection.md) - Comprehensive coverage including:
- Attack vectors specific to MCP servers
- Indirect injection via external data (Jira/Confluence content)
- Sanitization strategies with code examples
- Testing methodology with sample payloads

**Quick Checklist:**
- [ ] User-generated content wrapped with boundary markers
- [ ] Structured JSON output preferred over prose
- [ ] Field allowlisting (not returning entire API responses)
- [ ] Content length limits enforced
- [ ] Injection pattern detection/logging implemented
- [ ] HTML comments and hidden content stripped
- [ ] Custom fields treated as untrusted

**High-Risk Tools to Prioritize:**
- `get_issue`, `get_comments`, `search_jql` (user descriptions, comments)
- `get_page`, `get_page_comments`, `search_content` (wiki content)
- Any tool returning `description`, `body`, or `comment` fields

**Detection Commands:**
```bash
# Find unstructured text responses (higher injection risk)
grep -rn "type.*text.*text:" --include="*.ts" src/

# Find string interpolation in responses
grep -rn "text:.*\`.*\${" --include="*.ts" src/

# Check for sanitization functions (should exist!)
grep -rn "sanitize\|escape\|filter" --include="*.ts" src/
```

**Pattern to watch:**
```typescript
// VULNERABLE: Raw user content in response
return {
  content: [{ type: "text", text: `Description: ${issue.description}` }]
};

// SAFER: Structured output with boundaries
return {
  content: [{ 
    type: "text", 
    text: JSON.stringify({ 
      type: "jira_issue",
      data: { key: issue.key, description: sanitize(issue.description) }
    })
  }]
};
```

#### 3.3 Credential Exposure Prevention

**Audit credential handling:**
- [ ] API keys never included in tool responses
- [ ] OAuth tokens not logged
- [ ] Refresh tokens stored securely
- [ ] Credentials rotated on exposure
- [ ] Environment variables properly scoped

**Check for leaks:**
```bash
# Search for potential credential exposure
grep -rn "Authorization\|Bearer\|apiKey\|token" --include="*.ts" src/
grep -rn "console.log\|logger" --include="*.ts" src/ | grep -i "auth\|token\|key"
```

#### 3.4 Rate Limiting & DoS Protection

**Verify rate limit handling:**
- [ ] Rate limits enforced on all tools
- [ ] Retry logic has exponential backoff
- [ ] Maximum retry attempts capped
- [ ] Bulk operations paginated
- [ ] Resource-intensive operations timeout

**Reference implementation:**
```typescript
// Good: Rate limit with backoff
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After') || 60;
  await sleep(parseInt(retryAfter) * 1000);
  // Track rate limit state
  this.rateLimitState.update(retryAfter);
}
```

---

### Phase 4: Runtime Security Testing

#### 4.1 Container Security Audit

**Dockerfile review:**
- [ ] Base image from trusted registry
- [ ] Non-root user for runtime
- [ ] Minimal attack surface (no unnecessary packages)
- [ ] No secrets in build layers
- [ ] Health checks implemented

**Verification commands:**
```bash
# Check for root user
grep -E "^USER" Dockerfile

# Scan container image
docker scan <image-name>
trivy image <image-name>

# Check running permissions
docker inspect --format='{{.Config.User}}' <container>
```

#### 4.2 Network Security Audit

**Check network configuration:**
- [ ] TLS required for all connections
- [ ] Certificate validation enabled
- [ ] Network policies restrict egress
- [ ] No unnecessary ports exposed
- [ ] Localhost-only binding where appropriate

**Docker compose review:**
```yaml
# GOOD: Restricted ports, no host network
services:
  mcp-server:
    ports:
      - "127.0.0.1:3000:3000"  # Localhost only
    networks:
      - internal

# BAD: Wide-open exposure
services:
  mcp-server:
    ports:
      - "3000:3000"  # Exposed to all interfaces
    network_mode: host
```

#### 4.3 Logging & Monitoring Audit

**Verify security logging:**
- [ ] Authentication events logged
- [ ] Tool invocations logged (without sensitive params)
- [ ] Errors logged with correlation IDs
- [ ] Logs don't contain secrets
- [ ] Log rotation configured

---

# Audit Output

## Reporting

After completing the audit, generate a report using:

**Reference:** [Audit Report Template](./reference/audit-report-template.md)

### Severity Classification

| Severity | Description | Response Time |
|----------|-------------|---------------|
| Critical | Active exploitation possible, data breach risk | Immediate |
| High | Significant vulnerability, requires prompt action | 24-48 hours |
| Medium | Security weakness, should be addressed | 1-2 weeks |
| Low | Minor issue, best practice deviation | Next release |
| Info | Observation, no immediate risk | As convenient |

### Vulnerability Scoring

Use CVSS 3.1 for standard vulnerabilities or AIVSS for AI-specific issues.

**Common weakness mapping:**
- CWE-20: Improper Input Validation
- CWE-79: Cross-site Scripting (if web interface)
- CWE-89: SQL Injection
- CWE-94: Code Injection
- CWE-200: Exposure of Sensitive Information
- CWE-284: Improper Access Control
- CWE-311: Missing Encryption
- CWE-522: Insufficiently Protected Credentials

---

# Reference Files

## Documentation Library

Load these resources during the audit:

### Security Checklists
- [Security Checklist](./reference/security-checklist.md) - Complete audit checklist with pass/fail criteria

### Vulnerability Patterns
- [Vulnerability Patterns](./reference/vulnerability-patterns.md) - Common vulnerabilities and detection patterns

### Prompt Injection (Critical for MCP)
- [Prompt Injection Security](./reference/prompt-injection.md) - Attack vectors, sanitization strategies, and testing methodology

### Remediation Guidance
- [Remediation Templates](./reference/remediation-templates.md) - Fix patterns for common issues

### Reporting
- [Audit Report Template](./reference/audit-report-template.md) - Standard report format

---

# Quick Start

## Automated Scan Commands

Run these commands to begin the audit:

```bash
# 1. Dependency vulnerability scan
npm audit --json > reports/npm-audit.json

# 2. Static analysis
npx eslint . --ext .ts -f json > reports/eslint.json

# 3. Secret scanning
npx secretlint "**/*" --format json > reports/secrets.json

# 4. Type checking
npx tsc --noEmit 2>&1 | tee reports/typescript.txt

# 5. Container scanning (if applicable)
trivy image $(docker images -q | head -1) -f json > reports/container.json
```

## Manual Review Priorities

1. **Critical first:** Prompt injection (tool responses), authentication, credential handling
2. **High priority:** Input validation, error handling, data exposure
3. **Then:** Logging, rate limiting, tool annotations
4. **Finally:** Container security, network config, dependencies

---

# Compliance Mapping

## Framework Alignment

This audit covers requirements from:

| Framework | Relevant Controls |
|-----------|------------------|
| OWASP Top 10 | A01-A10 (2021) |
| CWE Top 25 | Most Dangerous Software Weaknesses |
| NIST 800-53 | AC, AU, IA, SC, SI families |
| SOC 2 | CC6, CC7 (Security) |
| ISO 27001 | A.12, A.14 (Operations, Development) |

## MCP-Specific Standards

Based on Model Context Protocol Security initiative:
- MCP Top 10 Server-Side Risks
- MCP Top 10 Client-Side Risks
- MCP Security Best Practices Guide
