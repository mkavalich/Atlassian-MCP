# MCP Server Security Audit Report Template

## Document Information

| Field | Value |
|-------|-------|
| **Report Title** | Security Audit: [Server Name] |
| **Version** | 1.0 |
| **Date** | [YYYY-MM-DD] |
| **Auditor** | [Name/Team] |
| **Classification** | [Confidential/Internal] |

---

## Executive Summary

### Overall Risk Rating

| Rating | Score | Description |
|--------|-------|-------------|
| ☐ Critical | 0-49 | Immediate action required. Active exploitation risk. |
| ☐ High | 50-69 | Significant vulnerabilities. Address within 48 hours. |
| ☐ Medium | 70-89 | Notable weaknesses. Address within 2 weeks. |
| ☐ Low | 90-100 | Minor issues. Address in next release cycle. |

**Overall Score:** [XX/100]

### Key Findings Summary

| Severity | Count | Categories |
|----------|-------|------------|
| Critical | X | [e.g., Credential exposure, Command injection] |
| High | X | [e.g., Missing input validation, Auth bypass] |
| Medium | X | [e.g., Verbose errors, Missing rate limits] |
| Low | X | [e.g., Minor logging issues, Best practice deviations] |
| Info | X | [Observations, recommendations] |

### Recommendations Priority

1. **Immediate (0-24 hours):** [List critical items]
2. **Short-term (1-7 days):** [List high items]
3. **Medium-term (1-4 weeks):** [List medium items]
4. **Long-term (next release):** [List low items]

---

## Scope and Methodology

### Audit Scope

**Repository:** [URL or path]
**Commit/Version:** [SHA or version]
**Date Range:** [Start] to [End]

**In Scope:**
- [ ] Source code review
- [ ] Dependency analysis
- [ ] Container security
- [ ] Configuration review
- [ ] Runtime testing

**Out of Scope:**
- [List any exclusions]

### Methodology

This audit follows the MCP Security initiative guidelines and includes:

1. **Static Analysis:** Automated code scanning with [tools used]
2. **Manual Review:** Line-by-line review of security-critical code
3. **Dependency Audit:** NPM audit and manual package review
4. **Container Analysis:** Dockerfile and image scanning
5. **Configuration Review:** Environment and deployment config

### Tools Used

| Tool | Version | Purpose |
|------|---------|---------|
| npm audit | 8.x | Dependency vulnerabilities |
| ESLint + security plugin | 8.x | Static code analysis |
| Trivy | 0.4x | Container scanning |
| secretlint | 7.x | Secret detection |
| [Custom scripts] | - | MCP-specific checks |

---

## Detailed Findings

### Finding Template

```
### [F-XXX] [Finding Title]

**Severity:** [Critical/High/Medium/Low/Info]
**Category:** [Input Validation/Authentication/etc.]
**CWE:** [CWE-XXX: Name]
**CVSS Score:** [0.0-10.0] (if applicable)

#### Description
[Detailed description of the vulnerability]

#### Location
- File: `path/to/file.ts`
- Line(s): XX-YY
- Function/Method: `functionName`

#### Evidence
```[language]
[Code snippet showing the vulnerability]
```

#### Impact
[Description of potential impact if exploited]

#### Recommendation
[Specific steps to remediate]

```[language]
[Code example of the fix]
```

#### References
- [Link to relevant documentation]
- [CWE link]

#### Status
- [ ] Acknowledged
- [ ] In Progress
- [ ] Resolved
- [ ] Won't Fix (with justification)
```

---

## Findings by Category

### 1. Input Validation

#### [F-001] [Finding Title]
...

#### [F-002] [Finding Title]
...

### 2. Authentication & Authorization

#### [F-003] [Finding Title]
...

### 3. Error Handling

#### [F-004] [Finding Title]
...

### 4. Data Protection

#### [F-005] [Finding Title]
...

### 5. MCP-Specific Security

#### [F-006] [Finding Title]
...

### 6. Rate Limiting & DoS

#### [F-007] [Finding Title]
...

### 7. Container Security

#### [F-008] [Finding Title]
...

### 8. Dependency Security

#### [F-009] [Finding Title]
...

### 9. Logging & Monitoring

#### [F-010] [Finding Title]
...

### 10. Network Security

#### [F-011] [Finding Title]
...

---

## Compliance Mapping

### OWASP Top 10 (2021)

| Category | Findings | Status |
|----------|----------|--------|
| A01:2021 - Broken Access Control | F-XXX | ☐ Pass ☐ Fail |
| A02:2021 - Cryptographic Failures | F-XXX | ☐ Pass ☐ Fail |
| A03:2021 - Injection | F-XXX | ☐ Pass ☐ Fail |
| A04:2021 - Insecure Design | F-XXX | ☐ Pass ☐ Fail |
| A05:2021 - Security Misconfiguration | F-XXX | ☐ Pass ☐ Fail |
| A06:2021 - Vulnerable Components | F-XXX | ☐ Pass ☐ Fail |
| A07:2021 - Auth Failures | F-XXX | ☐ Pass ☐ Fail |
| A08:2021 - Software/Data Integrity | F-XXX | ☐ Pass ☐ Fail |
| A09:2021 - Logging Failures | F-XXX | ☐ Pass ☐ Fail |
| A10:2021 - SSRF | F-XXX | ☐ Pass ☐ Fail |

### MCP Top 10 Server-Side Risks

| Risk | Findings | Status |
|------|----------|--------|
| Tool Poisoning | F-XXX | ☐ Pass ☐ Fail |
| Prompt Injection | F-XXX | ☐ Pass ☐ Fail |
| Credential Exposure | F-XXX | ☐ Pass ☐ Fail |
| Input Validation Bypass | F-XXX | ☐ Pass ☐ Fail |
| Server Spoofing | F-XXX | ☐ Pass ☐ Fail |
| Insecure Dependencies | F-XXX | ☐ Pass ☐ Fail |
| Insufficient Logging | F-XXX | ☐ Pass ☐ Fail |
| DoS Vulnerabilities | F-XXX | ☐ Pass ☐ Fail |
| Privilege Escalation | F-XXX | ☐ Pass ☐ Fail |
| Data Exfiltration | F-XXX | ☐ Pass ☐ Fail |

---

## Scan Results Summary

### npm audit

```
Vulnerabilities found: X

Critical: X
High: X
Medium: X
Low: X

[Include actual npm audit output or summary]
```

### Container Scan (Trivy)

```
[Include Trivy scan summary]
```

### Secret Scan

```
Files scanned: XXX
Secrets found: X

[List any findings]
```

### Static Analysis

```
Files analyzed: XXX
Issues found: X

Critical: X
Warning: X
Info: X
```

---

## Positive Findings

Areas where the implementation demonstrates good security practices:

1. **[Category]:** [Description of good practice]
2. **[Category]:** [Description of good practice]
3. **[Category]:** [Description of good practice]

---

## Remediation Roadmap

### Phase 1: Immediate (0-24 hours)

| Finding | Action | Owner | Status |
|---------|--------|-------|--------|
| F-XXX | [Action item] | [Name] | ☐ |
| F-XXX | [Action item] | [Name] | ☐ |

### Phase 2: Short-term (1-7 days)

| Finding | Action | Owner | Status |
|---------|--------|-------|--------|
| F-XXX | [Action item] | [Name] | ☐ |
| F-XXX | [Action item] | [Name] | ☐ |

### Phase 3: Medium-term (1-4 weeks)

| Finding | Action | Owner | Status |
|---------|--------|-------|--------|
| F-XXX | [Action item] | [Name] | ☐ |
| F-XXX | [Action item] | [Name] | ☐ |

### Phase 4: Long-term (next release)

| Finding | Action | Owner | Status |
|---------|--------|-------|--------|
| F-XXX | [Action item] | [Name] | ☐ |
| F-XXX | [Action item] | [Name] | ☐ |

---

## Appendices

### Appendix A: Full Scan Outputs

[Attach or link to full scan outputs]

### Appendix B: Test Cases

[Document any specific test cases executed]

### Appendix C: Environment Details

| Component | Version/Details |
|-----------|-----------------|
| Node.js | vXX.XX.X |
| npm | vXX.XX.X |
| TypeScript | vX.X.X |
| OS | [OS details] |
| Docker | vXX.XX.X |

### Appendix D: Glossary

| Term | Definition |
|------|------------|
| CWE | Common Weakness Enumeration |
| CVSS | Common Vulnerability Scoring System |
| MCP | Model Context Protocol |
| OWASP | Open Web Application Security Project |

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Auditor | | | |
| Technical Lead | | | |
| Security Owner | | | |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [Date] | [Name] | Initial audit report |
| | | | |

---

## Report Generation Commands

Use these commands to generate supporting data for the report:

```bash
# Generate npm audit JSON
npm audit --json > reports/npm-audit.json

# Generate dependency tree
npm ls --all --json > reports/dependencies.json

# Run ESLint with JSON output
npx eslint . --ext .ts -f json > reports/eslint.json

# Container scan
trivy image <image> -f json > reports/trivy.json

# Secret scan
npx secretlint "**/*" --format json > reports/secrets.json

# Generate SBOM (Software Bill of Materials)
npx @cyclonedx/cyclonedx-npm --output-file reports/sbom.json

# Combine into report
echo "Audit completed: $(date)" >> reports/summary.txt
```
