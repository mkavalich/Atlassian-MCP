# MCP Server Security Checklist

## Overview

Use this checklist to systematically verify security controls in MCP server implementations. Each item should be marked as PASS, FAIL, or N/A with notes.

---

## 1. Input Validation {#input-validation}

### 1.1 Schema Definition

| Check | Status | Notes |
|-------|--------|-------|
| All tools have defined input schemas | ☐ | |
| Schemas use strict mode (`.strict()`) | ☐ | |
| String inputs have max length limits | ☐ | |
| Numeric inputs have min/max bounds | ☐ | |
| Enum types used where values are constrained | ☐ | |
| Regex patterns validate format-sensitive strings | ☐ | |
| Default values are secure | ☐ | |

### 1.2 Injection Prevention

| Check | Status | Notes |
|-------|--------|-------|
| SQL parameters use parameterized queries | ☐ | |
| Shell commands don't interpolate user input | ☐ | |
| URL construction uses URL API (not string concat) | ☐ | |
| Path inputs validated against traversal (../) | ☐ | |
| XML/JSON inputs not passed to eval() | ☐ | |
| Template strings sanitize interpolated values | ☐ | |

### 1.3 Edge Case Handling

| Check | Status | Notes |
|-------|--------|-------|
| Empty string inputs handled | ☐ | |
| Null/undefined inputs rejected or defaulted | ☐ | |
| Oversized inputs rejected with clear error | ☐ | |
| Unicode edge cases handled (zalgo, RTL) | ☐ | |
| Numeric overflow/underflow handled | ☐ | |

**Verification Commands:**
```bash
# Find all Zod schemas
grep -rn "z.object\|z.string\|z.number" --include="*.ts" src/

# Check for strict mode usage
grep -rn "\.strict()" --include="*.ts" src/

# Find potential injection points
grep -rn "exec\|spawn\|eval\|Function(" --include="*.ts" src/
```

---

## 2. Authentication & Authorization {#authentication}

### 2.1 Credential Storage

| Check | Status | Notes |
|-------|--------|-------|
| No hardcoded credentials in source code | ☐ | |
| Credentials loaded from environment variables | ☐ | |
| `.env` files in `.gitignore` | ☐ | |
| `.env.example` documents required vars (no values) | ☐ | |
| Secrets not in Dockerfile or docker-compose.yml | ☐ | |
| No credentials in log output | ☐ | |

### 2.2 Token Management

| Check | Status | Notes |
|-------|--------|-------|
| OAuth tokens properly scoped (least privilege) | ☐ | |
| Token refresh implemented for long sessions | ☐ | |
| Expired tokens handled gracefully | ☐ | |
| Tokens not included in error messages | ☐ | |
| Tokens not passed in URL query strings | ☐ | |

### 2.3 Auth Failure Handling

| Check | Status | Notes |
|-------|--------|-------|
| Auth errors return generic messages | ☐ | |
| Failed auth attempts logged (without credentials) | ☐ | |
| No timing difference between valid/invalid users | ☐ | |
| Rate limiting on auth endpoints | ☐ | |

**Verification Commands:**
```bash
# Search for hardcoded credentials
grep -rn "password\|secret\|apiKey\|token" --include="*.ts" src/ | grep -v "process.env"

# Check .gitignore
grep "\.env" .gitignore

# Find credential logging
grep -rn "console.log\|logger" --include="*.ts" src/ | grep -iE "auth|token|key|secret"
```

---

## 3. Error Handling {#error-handling}

### 3.1 Error Sanitization

| Check | Status | Notes |
|-------|--------|-------|
| Stack traces not exposed in production | ☐ | |
| Internal error details sanitized | ☐ | |
| Error messages don't leak system paths | ☐ | |
| Database error details hidden | ☐ | |
| API error responses consistent format | ☐ | |

### 3.2 Error Context

| Check | Status | Notes |
|-------|--------|-------|
| Correlation IDs in error responses | ☐ | |
| Actionable error messages for users | ☐ | |
| Different handling for client vs server errors | ☐ | |
| Retry guidance for transient errors | ☐ | |

### 3.3 Sensitive Data in Errors

| Check | Status | Notes |
|-------|--------|-------|
| No PII in error messages | ☐ | |
| No credentials in error context | ☐ | |
| No internal IPs/hostnames exposed | ☐ | |
| Request bodies not echoed in errors | ☐ | |

**Verification Commands:**
```bash
# Check error handling patterns
grep -rn "catch\|throw\|Error" --include="*.ts" src/

# Look for potential information leaks
grep -rn "stack\|message" --include="*.ts" src/ | grep -v "test"
```

---

## 4. Data Protection {#data-protection}

### 4.1 Data in Transit

| Check | Status | Notes |
|-------|--------|-------|
| TLS required for all API connections | ☐ | |
| Certificate validation enabled | ☐ | |
| No HTTP fallback for HTTPS endpoints | ☐ | |
| Secure headers configured (if web interface) | ☐ | |

### 4.2 Data at Rest

| Check | Status | Notes |
|-------|--------|-------|
| Sensitive config encrypted if persisted | ☐ | |
| Temp files use secure deletion | ☐ | |
| Cache doesn't store sensitive data unencrypted | ☐ | |
| Database connections use TLS | ☐ | |

### 4.3 Data Minimization

| Check | Status | Notes |
|-------|--------|-------|
| Only necessary data fetched from APIs | ☐ | |
| Sensitive fields filtered from responses | ☐ | |
| Pagination limits prevent bulk data exposure | ☐ | |
| PII handling documented | ☐ | |

---

## 5. MCP-Specific Security {#mcp-specific}

### 5.1 Tool Definition Security

| Check | Status | Notes |
|-------|--------|-------|
| Tool descriptions accurate (no hidden prompts) | ☐ | |
| Tool annotations match actual behavior | ☐ | |
| `destructiveHint` true for write/delete ops | ☐ | |
| `readOnlyHint` true for GET operations | ☐ | |
| `idempotentHint` accurate | ☐ | |
| No dynamic tool generation from untrusted input | ☐ | |

### 5.2 Prompt Injection Prevention

| Check | Status | Notes |
|-------|--------|-------|
| User input not concatenated into prompts | ☐ | |
| Tool outputs escaped before LLM processing | ☐ | |
| Pagination cursors validated format | ☐ | |
| Search queries sanitized | ☐ | |

### 5.3 Response Security

| Check | Status | Notes |
|-------|--------|-------|
| API keys never in tool responses | ☐ | |
| Internal URLs not exposed | ☐ | |
| Sensitive metadata filtered | ☐ | |
| Response size limits enforced | ☐ | |

**Verification Commands:**
```bash
# Check tool annotations
grep -rn "destructiveHint\|readOnlyHint\|idempotentHint" --include="*.ts" src/

# Find potential prompt injection vectors
grep -rn "content.*text.*\${" --include="*.ts" src/
```

---

## 6. Rate Limiting & Resource Protection {#rate-limiting}

### 6.1 Rate Limit Handling

| Check | Status | Notes |
|-------|--------|-------|
| Rate limit responses handled (429) | ☐ | |
| Exponential backoff implemented | ☐ | |
| Max retry attempts capped | ☐ | |
| Rate limit state tracked per endpoint | ☐ | |

### 6.2 Resource Limits

| Check | Status | Notes |
|-------|--------|-------|
| Request timeouts configured | ☐ | |
| Response size limits enforced | ☐ | |
| Pagination defaults are reasonable | ☐ | |
| Bulk operations have limits | ☐ | |

### 6.3 DoS Prevention

| Check | Status | Notes |
|-------|--------|-------|
| Connection pooling with limits | ☐ | |
| Memory-intensive ops have guards | ☐ | |
| File operations size-limited | ☐ | |
| Recursive operations depth-limited | ☐ | |

---

## 7. Container Security {#container-security}

### 7.1 Dockerfile Security

| Check | Status | Notes |
|-------|--------|-------|
| Base image from trusted registry | ☐ | |
| Base image version pinned | ☐ | |
| Non-root USER directive | ☐ | |
| No COPY of sensitive files | ☐ | |
| Multi-stage build (minimal final image) | ☐ | |
| No unnecessary packages installed | ☐ | |

### 7.2 Runtime Security

| Check | Status | Notes |
|-------|--------|-------|
| Read-only root filesystem (where possible) | ☐ | |
| No privileged mode | ☐ | |
| Capabilities dropped | ☐ | |
| Resource limits set (memory, CPU) | ☐ | |
| Health checks implemented | ☐ | |

### 7.3 Image Scanning

| Check | Status | Notes |
|-------|--------|-------|
| No critical CVEs in base image | ☐ | |
| No high CVEs without mitigation | ☐ | |
| Scan integrated in CI/CD | ☐ | |

**Verification Commands:**
```bash
# Check Dockerfile
grep -E "^USER|^FROM|COPY.*\.env|--privileged" Dockerfile

# Scan image
trivy image <image-name>
docker scan <image-name>
```

---

## 8. Dependency Security {#dependencies}

### 8.1 Known Vulnerabilities

| Check | Status | Notes |
|-------|--------|-------|
| No critical vulnerabilities | ☐ | |
| No high vulnerabilities without mitigation | ☐ | |
| Dependency lock file present | ☐ | |
| Lock file committed to repo | ☐ | |

### 8.2 Supply Chain

| Check | Status | Notes |
|-------|--------|-------|
| Dependencies from trusted registries | ☐ | |
| No typosquatting packages | ☐ | |
| Packages have active maintenance | ☐ | |
| Minimal transitive dependencies | ☐ | |

### 8.3 Update Policy

| Check | Status | Notes |
|-------|--------|-------|
| Automated security updates enabled | ☐ | |
| Dependabot/Renovate configured | ☐ | |
| Regular dependency review process | ☐ | |

**Verification Commands:**
```bash
# NPM audit
npm audit --json

# Check for outdated
npm outdated

# List all dependencies
npm ls --all
```

---

## 9. Logging & Monitoring {#logging}

### 9.1 Security Logging

| Check | Status | Notes |
|-------|--------|-------|
| Auth events logged | ☐ | |
| Tool invocations logged | ☐ | |
| Errors logged with context | ☐ | |
| Security events clearly marked | ☐ | |

### 9.2 Log Security

| Check | Status | Notes |
|-------|--------|-------|
| No secrets in logs | ☐ | |
| No PII in logs (or properly masked) | ☐ | |
| Log injection prevented | ☐ | |
| Correlation IDs for tracing | ☐ | |

### 9.3 Log Management

| Check | Status | Notes |
|-------|--------|-------|
| Log rotation configured | ☐ | |
| Log retention policy defined | ☐ | |
| Logs protected from tampering | ☐ | |

---

## 10. Network Security {#network}

### 10.1 Port Exposure

| Check | Status | Notes |
|-------|--------|-------|
| Only necessary ports exposed | ☐ | |
| Localhost binding where appropriate | ☐ | |
| No management ports publicly exposed | ☐ | |

### 10.2 TLS Configuration

| Check | Status | Notes |
|-------|--------|-------|
| TLS 1.2+ required | ☐ | |
| Strong cipher suites only | ☐ | |
| Certificate chain valid | ☐ | |
| HSTS enabled (if web interface) | ☐ | |

---

## Summary Scoring

| Category | Pass | Fail | N/A | Score |
|----------|------|------|-----|-------|
| Input Validation | | | | /100 |
| Authentication | | | | /100 |
| Error Handling | | | | /100 |
| Data Protection | | | | /100 |
| MCP-Specific | | | | /100 |
| Rate Limiting | | | | /100 |
| Container Security | | | | /100 |
| Dependencies | | | | /100 |
| Logging | | | | /100 |
| Network Security | | | | /100 |
| **Overall** | | | | **/100** |

**Risk Rating:**
- 90-100: Low Risk
- 70-89: Medium Risk
- 50-69: High Risk
- <50: Critical Risk
