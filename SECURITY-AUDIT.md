# MCP Server Security Audit Report

## Document Information

| Field | Value |
|-------|-------|
| **Report Title** | Security Audit: Atlassian MCP Servers |
| **Version** | 1.0 |
| **Date** | 2026-02-25 |
| **Auditor** | Claude Code (automated) |
| **Commit** | `31d72fe` (main) |
| **Scope** | 275 tools across 8 servers + shared packages |

---

## Executive Summary

### Overall Risk Rating: Medium (Score: 72/100) — REMEDIATED 2026-07-06

> **Remediation complete.** All findings in this report have been resolved on branch
> `security/audit-remediation`. `npm audit` now reports **0 vulnerabilities** (was 1
> critical + 15 high + 9 moderate + 2 low), and every code-level finding (F-001, F-003–
> F-016) plus the dependency finding (F-017) has been fixed and verified. See the
> **Remediation Status** section below. Regression gates held throughout: `npm run
> build:all` exit 0, `npm run test:all` 132 tests pass / 0 fail, per-server
> `tsc --noEmit` error counts unchanged or reduced from baseline.

The codebase demonstrates **strong foundational security** -- credentials are never hardcoded in source, `.gitignore` is comprehensive, error sanitization exists in all 8 servers, Docker containers run as non-root with localhost-only port binding, and tool annotations are accurate. However, there are **systemic gaps in defense-in-depth** that should be addressed before open-source release.

### Key Findings Summary

| Severity | Count | Categories |
|----------|-------|------------|
| Critical | 0 | No active exploitation risks in source code |
| High | 3 | Missing input validation (43 tools), CQL injection, path injection |
| Medium | 12 | JQL injection, error disclosure, incomplete sanitization, Docker hardening |
| Low | 10 | Logging verbosity, legacy Dockerfiles, health check spoofing |
| Info | 3 | Dependency updates available, credential rotation advisory |

### Remediation Priority

1. **Before Release (blockers):** F-001, F-003, F-005 -- fix validation gaps, CQL injection, path encoding
2. **Short-term (1-7 days):** F-004, F-006, F-007, F-010 -- JQL constraints, error sanitization, prompt injection
3. **Medium-term (1-4 weeks):** F-008, F-009, F-011-F-016 -- Docker hardening, logging, string bounds
4. **Long-term:** F-017-F-022 -- container resource limits, log rotation, dependency updates

---

## Remediation Status (2026-07-06)

All actionable findings are resolved on branch `security/audit-remediation`. Verification
after every phase: `npm audit` = 0 vulns, `npm run build:all` exit 0, `npm run test:all`
132 tests pass / 0 fail, per-server `tsc --noEmit` at or below baseline. An adversarial
per-server review round then re-probed each schema with realistic Atlassian inputs
(personal space keys, ARIs, account IDs, unicode names) to confirm no legitimate input is
rejected, and with injection payloads to confirm they are blocked.

| Finding | Severity | Status | Resolution |
|---------|----------|--------|------------|
| F-001 | High | ✅ Fixed | Strict `.parse()` added to all previously unvalidated handlers (jira-organization 17, jira-service-desk 10, jira-projects 2, confluence 2, jira-workflows 1); missing strict schemas created. |
| F-003 | High | ✅ Fixed | CQL quote/backslash escaping + regex-constrained `spaceKey`/`type` in confluence `search_content`. |
| F-004 | Medium | ✅ Fixed | `projectKey`/`accountId`/date-range fields regex-constrained + `jqlSafe()` escaping at all JQL interpolation sites. |
| F-005 | High | ✅ Fixed | All ID/key schema fields regex-constrained; `encodeURIComponent()` on free-form path segments. |
| F-006 | Medium | ✅ Fixed | `.max()` length bounds added across strict + passthrough schemas (per-type guideline sizes). |
| F-007 | Medium | ✅ Fixed | `formatToolError()` added; `handleError` requestUrl/method merge re-run through `sanitizeErrorDetails`; tool catch blocks route `error.message` through `sanitizeErrorMessage`. |
| F-008 | Medium | ✅ Fixed | `wrapUserContent()`/sanitize helpers wired into tools returning user content; jira-service-desk's unused sanitizer activated. |
| F-009 | Medium | ✅ Fixed | `openWorldHint: false` added to the 35 jira-workflows tool registrations that lacked it. |
| F-010 | Medium | ✅ Fixed | Base images pinned to SHA256 digest (`node:20-slim@sha256:2cf067cf…`) in all in-use Dockerfiles. |
| F-011 | Low | ✅ Fixed | 6 legacy Node-18 `servers/*/Dockerfile` deleted. |
| F-012 | Medium | ✅ Fixed | `.dockerignore` added to the 6 server dirs that lacked one. |
| F-013 | Medium | ✅ Fixed | Internal (`internal: true`) network for inter-container traffic + separate egress bridge for the Atlassian API. |
| F-014 | Medium | ✅ Fixed | `mem_limit 512m` / `cpus 0.5` (+ swarm `deploy.resources.limits`) on all services. |
| F-015 | Medium | ✅ Fixed | `redactSensitive()` applied to `logError`/interceptor; query strings stripped in `logApiCall`; jira-workflows automation.ts no longer logs full objects. |
| F-016 | Low | ✅ Fixed | `sanitizeErrorMessage` now scrubs http(s) URLs. |
| F-017 | Info/Low | ✅ Fixed | All 27 npm-audit advisories resolved (deps + overrides); `@typescript-eslint`→v8, `esbuild`→0.28, `tsx`→4.23. |

**Additional hardening applied during remediation:** each server's `wrappedHandler` now
strips the optimization-only `responseFormat` param before strict validation runs, so
`.strict()` schemas no longer reject it — fixing a pre-existing latent break while keeping
the token-optimization feature working.

**Not addressed (advisory, unchanged):** the Local-Only Credential Advisory below — those
tokens live only on the developer machine (gitignored, never committed) and rotation is a
manual operator action, not a code change.

---

## Scope and Methodology

### In Scope
- [x] Source code review (all 8 servers + shared packages)
- [x] Dependency analysis (npm audit)
- [x] Secret scanning (git history + filesystem)
- [x] Container security (Dockerfiles + docker-compose)
- [x] Input validation audit (Zod schemas across 275 tools)
- [x] Error handling audit (all catch blocks and error formatters)
- [x] MCP-specific security (prompt injection, tool annotations)
- [x] Runtime configuration (logging, networking)

### Out of Scope
- Penetration testing against live Atlassian instance
- Third-party npm package source code review
- Performance/load testing

---

## Detailed Findings

### 1. Input Validation

#### [F-001] 43 Tools Missing Strict Schema Validation

**Severity:** HIGH
**CWE:** CWE-20 (Improper Input Validation)

**Description:** The codebase uses a split-schema architecture: `schemas.ts` files use `.strict()` for runtime validation, while `input-schemas.ts` use `.passthrough()` for MCP registration. However, 43 tool handlers across 3 servers accept `params: any` and never call a `.strict()` schema `.parse()`, meaning the only validation applied is the permissive `.passthrough()` schema.

**Affected servers:**
| Server | Tools Missing Validation |
|--------|--------------------------|
| jira-organization | 17 tools (global-users, identity-providers, directory-health, etc.) |
| jira-service-desk | 10 tools (service-desk, customer-organizations) |
| jira-workflows | 1 tool (setup_workflow_guided) |
| jira-projects | 2 tools (generate_project_report, get_project_analytics) |
| confluence | 2 tools (1 in admin.ts, 1 in permissions.ts) |

**Impact:** Unvalidated user input is interpolated into API paths and query strings, enabling path injection (F-005) and query injection (F-004).

**Recommendation:** Add `strictSchema.parse(params)` at the start of every tool handler. Create a CI test that verifies every registered tool calls `.parse()`.

---

#### [F-003] CQL Injection in search_content

**Severity:** HIGH
**CWE:** CWE-943 (Improper Neutralization of Special Elements in Data Query Logic)

**Description:** The `search_content` tool constructs CQL by directly interpolating user input:
```typescript
// servers/confluence/src/tools/content.ts, line 1030
let cql = `text~"${validatedParams.query}"`;
if (validatedParams.spaceKey) {
  cql += ` AND space=${validatedParams.spaceKey}`;
}
```

A query containing `"` breaks out of the CQL string literal. For example, `" OR type=page OR text~"` produces: `text~"" OR type=page OR text~""`.

**Recommendation:**
1. Escape double quotes: `validatedParams.query.replace(/"/g, '\\"')`
2. Add regex constraint to `spaceKey`: `.regex(/^[A-Z][A-Z0-9]*$/)`
3. Quote `spaceKey` in CQL: `space="${validatedParams.spaceKey}"`

---

#### [F-004] JQL Injection via String Interpolation

**Severity:** MEDIUM
**CWE:** CWE-943

**Description:** 7 locations across 3 servers construct JQL by interpolating user values into template literals without escaping or regex constraints.

**Key locations:**
- `servers/jira-projects/src/tools/reporting.ts:230` -- `project = "${projectKey}"`
- `servers/jira-system-admin/src/tools/reporting.ts:65` -- `project = "${validatedParams.projectKey}"`
- `servers/jira-product-discovery/src/tools/ideas.ts:45` -- `project = "${projectKey}"`

**Recommendation:** Enforce `projectKey` regex: `.regex(/^[A-Z][A-Z0-9]{1,9}$/)`. For `accountId`, use `.regex(/^[a-zA-Z0-9:]+$/)`.

---

#### [F-005] No URL Encoding in API Path Construction

**Severity:** HIGH
**CWE:** CWE-74 (Improper Neutralization of Special Elements in Output)

**Description:** 217 instances of template literal path interpolation (`path: \`/.../${variable}\``) across 38 tool files. The API clients pass `path` directly to axios without `encodeURIComponent()`. Combined with the 43 unvalidated tools (F-001), user-supplied values like `directoryId`, `serviceDeskId`, and `organizationId` are interpolated into paths without any constraint.

**Recommendation:**
1. Apply `encodeURIComponent()` to all user-supplied path segments in API client `makeRequest()`
2. Add regex validation on all ID-type fields (`.regex(/^[\w\-]+$/)`)

---

#### [F-006] Unbounded String Inputs (DoS Vector)

**Severity:** MEDIUM
**CWE:** CWE-770 (Allocation of Resources Without Limits)

**Description:** Of 1,865 `z.string()` usages across all input schemas, only 314 (17%) have `.max()` length constraints. Body/content fields in Confluence schemas have no max limit, allowing arbitrarily large payloads.

**Recommendation:** Add `.max()` to all string inputs. Suggested limits: IDs `.max(128)`, names `.max(255)`, descriptions `.max(10000)`, body/content `.max(1000000)`, JQL/CQL `.max(10000)`.

---

### 2. Error Handling

#### [F-007] Error Details Bypass Sanitization Pipeline

**Severity:** MEDIUM
**CWE:** CWE-209 (Generation of Error Message Containing Sensitive Information)

**Description:** Three related gaps in error handling:

1. **Post-sanitization reassignment (8 servers):** API clients add `requestUrl` and `requestMethod` to `error.details` *after* the `JiraApiError` constructor runs `sanitizeErrorDetails()`, bypassing sanitization.

2. **Raw `error.message` in 258 tool locations:** When a raw JavaScript Error (not `JiraApiError`) is caught, `error.message` is forwarded without passing through `sanitizeErrorMessage()`. These can contain file paths, stack fragments, and schema details.

3. **Raw error object as UNKNOWN_ERROR details (20+ locations):** The fallback catch block passes the entire error object as `details`, which may contain unexpected fields from non-standard Error subtypes.

**Recommendation:** Create a centralized `formatToolError()` utility that all tool catch blocks use, ensuring every error passes through sanitization before reaching the client response.

---

### 3. MCP-Specific Security

#### [F-008] Incomplete Prompt Injection Defenses

**Severity:** MEDIUM
**CWE:** CWE-94 (Improper Control of Generation of Code)

**Description:** Every MCP tool response flows back into the LLM's context. User-generated content from Jira/Confluence can contain malicious instructions the LLM might follow.

**Current state:** 4 servers have sanitization utilities (`wrapUserContent`, `sanitizePageBody`):
- jira-projects -- **USED** in issues.ts, reporting.ts
- confluence -- **USED** in pages.ts, comments.ts
- jira-product-discovery -- **USED** in ideas.ts
- jira-service-desk -- **EXISTS BUT UNUSED**

**Not sanitized (high-risk data flows):**
| Server | Tool | User Content |
|--------|------|-------------|
| jira-projects | `get_sprint_issues`, `get_board_backlog` | issue descriptions |
| confluence | `get_blog_post`, `search_cql`, `search_content` | page body, excerpts |
| jira-service-desk | all tools | request fields |

**Recommendation:**
1. Apply `wrapUserContent()` to all tools that return user-generated content
2. Wire up the existing but unused sanitizer in jira-service-desk
3. Add sanitization to confluence search/blog tools
4. Add sanitization to jira-projects agile tools

---

#### [F-009] Tool Annotations Incomplete in jira-workflows

**Severity:** MEDIUM

**Description:** 35 of 38 tools in jira-workflows are missing the `openWorldHint` annotation. All other servers have complete annotations.

**Recommendation:** Add `openWorldHint: false` to all jira-workflows tool registrations.

---

### 4. Container Security

#### [F-010] Docker Images Not Pinned to Digest

**Severity:** MEDIUM
**CWE:** CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)

**Description:** All Dockerfiles use tag-only references (`node:20-slim`, `node:18-alpine`) rather than SHA256 digests. A compromised or hijacked tag could introduce malicious code via supply chain.

**Recommendation:** Pin to digest: `FROM node:20-slim@sha256:<digest>`

---

#### [F-011] Legacy Dockerfiles with EOL Node 18

**Severity:** LOW

**Description:** 6 servers have root-level `Dockerfile` files using `node:18-alpine` (Node 18 EOL April 2025). These are superseded by the canonical `docker/Dockerfile` using Node 20.

**Recommendation:** Delete all 6 legacy `servers/*/Dockerfile` files.

---

#### [F-012] Missing .dockerignore in 6 Servers

**Severity:** MEDIUM

**Description:** 6 of 8 server `docker/` directories lack `.dockerignore` files. The `COPY . .` in builder stages copies `.env`, `.git`, and `node_modules` into build layers.

**Recommendation:** Add `.dockerignore` to all server directories excluding `.env*`, `.git`, `node_modules`, `tests`.

---

#### [F-013] No Network Isolation in docker-compose

**Severity:** MEDIUM

**Description:** The root `docker-compose.yml` does not define any networks. All 8 containers share the default bridge network and can communicate freely.

**Recommendation:** Define an `internal: true` network for inter-container isolation.

---

#### [F-014] No Container Resource Limits

**Severity:** MEDIUM

**Description:** No `mem_limit`, `cpus`, or `deploy.resources` constraints in docker-compose. A runaway process could consume all host resources.

**Recommendation:** Add `deploy.resources.limits.memory: 512M` and `deploy.resources.limits.cpus: "0.5"`.

---

### 5. Logging & Monitoring

#### [F-015] No Sensitive Data Filtering in Logs

**Severity:** MEDIUM

**Description:** `logError()` accepts arbitrary context and logs it without filtering. `logApiCall()` logs the full URL path. The API client request interceptor logs `config.params` at debug level. In jira-workflows `automation.ts`, 7 instances log `{ error, params }` (full objects) instead of `{ error: error.message }`.

**Recommendation:** Add a log sanitizer that redacts `authorization`, `apiToken`, `password`, and `email` fields before writing.

---

#### [F-016] sanitizeErrorMessage Does Not Scrub URLs

**Severity:** LOW

**Description:** All 8 servers' `sanitizeErrorMessage()` strips file paths but not HTTP URLs. Atlassian API error messages sometimes include site URLs.

**Recommendation:** Add URL scrubbing: `sanitized.replace(/https?:\/\/[^\s]+/g, '[url]')`.

---

### 6. Dependencies

#### [F-017] npm audit: 8 Vulnerabilities (6 High, 1 Moderate, 1 Low)

**Severity:** LOW (all in dev dependencies)

**Description:** All 8 vulnerabilities trace to `minimatch` via `@typescript-eslint/*` packages (dev dependencies only). These affect the ESLint toolchain, not the production runtime.

**Recommendation:** Update `@typescript-eslint/*` packages. Run `npm audit fix`.

---

## Positive Findings

The codebase demonstrates strong security practices in several areas:

1. **Credential Management:** All credentials loaded from environment variables. No hardcoded secrets in source code. `.gitignore` properly excludes `.env`, `.mcp.json`, `.claude/settings.local.json`. No secrets found in git history.

2. **Error Sanitization Framework:** Every server has `sanitizeErrorMessage()` and `sanitizeErrorDetails()` functions that strip stack traces, file paths, and sensitive keys (`password`, `token`, `secret`, `apiKey`, `authorization`, `cookie`, `session`).

3. **Docker Security:** Non-root users in all Dockerfiles. Multi-stage builds keep dev dependencies out of production. Ports bound to localhost only. No host volume mounts. Credentials via env var interpolation.

4. **TLS:** HTTPS for all outbound API calls. No `rejectUnauthorized: false` anywhere. No TLS bypass flags.

5. **Logging Architecture:** All logs directed to stderr (not stdout/MCP protocol channel). Structured JSON format with timestamps.

6. **Tool Annotations:** Accurate `readOnlyHint`, `destructiveHint`, `idempotentHint` on all sampled tools. Destructive operations correctly flagged.

7. **Response Formatting:** Data-driven response formatter in shared package. Tools that do sanitize use structured JSON output with field allowlisting.

8. **Rate Limiting:** API clients implement `429` detection, `Retry-After` header parsing, and exponential backoff with capped retries.

9. **Telemetry Redaction:** Shared telemetry module redacts sensitive keys before any telemetry recording.

10. **No Secrets in Git History:** Verified across all 19 commits -- no Atlassian tokens, PEM files, or `.env` content ever committed.

---

## Remediation Roadmap

### Phase 1: Before Release (Blockers)

| Finding | Action | Effort |
|---------|--------|--------|
| F-001 | Add strict schema validation to all 43 unvalidated tools | 4-6 hours |
| F-003 | Fix CQL injection in `search_content` (escape quotes, validate spaceKey) | 30 min |
| F-005 | Add `encodeURIComponent()` to API client path construction | 1-2 hours |

### Phase 2: Short-term (1-7 days)

| Finding | Action | Effort |
|---------|--------|--------|
| F-004 | Add regex constraints to JQL-interpolated fields | 1-2 hours |
| F-007 | Create centralized `formatToolError()` utility | 2-3 hours |
| F-008 | Extend prompt injection sanitization to remaining tools | 3-4 hours |
| F-012 | Add `.dockerignore` to 6 server directories | 30 min |

### Phase 3: Medium-term (1-4 weeks)

| Finding | Action | Effort |
|---------|--------|--------|
| F-006 | Add `.max()` to string inputs across all schemas | 3-4 hours |
| F-009 | Add `openWorldHint` to jira-workflows tools | 1 hour |
| F-010 | Pin Docker base images to SHA256 digests | 1 hour |
| F-011 | Delete 6 legacy Dockerfiles | 15 min |
| F-013 | Add internal network to docker-compose | 30 min |
| F-014 | Add resource limits to docker-compose | 30 min |
| F-015 | Add log sanitizer for sensitive fields | 2-3 hours |
| F-016 | Add URL scrubbing to sanitizeErrorMessage | 30 min |

### Phase 4: Long-term (Next Release)

| Finding | Action | Effort |
|---------|--------|--------|
| F-017 | Update @typescript-eslint packages | 1 hour |

---

## Local-Only Credential Advisory

The following files on disk (not in git) contain live credentials that should be rotated:

| File | Contents | In Git? |
|------|----------|---------|
| `.env` | 2 Atlassian API tokens, org ID, email | No (gitignored) |
| `.claude/settings.local.json` | 1 API token, JWT, MCP keys, ngrok token | No (gitignored) |

**Action:** Rotate all tokens before sharing this machine or backup. Consider a secrets manager for `.env` values. These are NOT a release blocker since they are properly gitignored and never committed.

---

## OWASP Top 10 Mapping

| Category | Status | Findings |
|----------|--------|----------|
| A01: Broken Access Control | PASS | Credential management is sound |
| A02: Cryptographic Failures | PASS | TLS enforced, no crypto misuse |
| A03: Injection | FAIL | F-003 (CQL), F-004 (JQL), F-005 (path) |
| A04: Insecure Design | PASS | Split-schema design is intentional |
| A05: Security Misconfiguration | WARN | F-012, F-013, F-014 (Docker) |
| A06: Vulnerable Components | WARN | F-017 (dev deps only) |
| A07: Auth Failures | PASS | Proper env var credential handling |
| A08: Integrity Failures | WARN | F-010 (unpinned images) |
| A09: Logging Failures | WARN | F-015, F-016 |
| A10: SSRF | PASS | No user-controlled URLs in outbound requests |

---

## MCP Top 10 Mapping

| Risk | Status | Findings |
|------|--------|----------|
| Tool Poisoning | PASS | Accurate annotations, no dynamic tool gen |
| Prompt Injection | WARN | F-008 (partial coverage) |
| Credential Exposure | PASS | No creds in responses or git history |
| Input Validation Bypass | FAIL | F-001, F-003, F-005, F-006 |
| Server Spoofing | PASS | Not applicable (local stdio transport) |
| Insecure Dependencies | WARN | F-017 (dev deps only) |
| Insufficient Logging | WARN | F-015 |
| DoS Vulnerabilities | WARN | F-006, F-014 |
| Privilege Escalation | PASS | Non-root containers, least privilege |
| Data Exfiltration | PASS | No outbound data channels beyond Atlassian API |
