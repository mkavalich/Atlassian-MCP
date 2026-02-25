# Epic Description Template

This template structures Epic descriptions to preserve context from JPD ideas.
The goal is to ensure delivery teams understand WHY this work was prioritized,
not just WHAT to build.

---

## Template Structure

```markdown
## Overview

[Idea summary - what is this about?]

## Origin

**Source:** [JPD Idea Link]
**Approved:** [Date]
**Champion:** [Product owner or requestor]

## Prioritization Context

This work was prioritized based on:

| Dimension | Score | Notes |
|-----------|-------|-------|
| Impact | [X/10] | [Brief rationale] |
| Effort | [X/10] | [Brief rationale] |
| Confidence | [X/10] | [Brief rationale] |
| Strategic Fit | [X/10] | [Brief rationale] |

**Overall Priority Score:** [X]
**Scoring Model:** [Model name if applicable]

## Customer Evidence

**Evidence Count:** [N] insights

### Key Themes

1. **[Theme 1]** - [Summary of evidence]
2. **[Theme 2]** - [Summary of evidence]
3. **[Theme 3]** - [Summary of evidence]

### Representative Quotes

> "[Customer quote 1]"
> — Customer type/segment

> "[Customer quote 2]"
> — Customer type/segment

## Problem Statement

[Detailed problem description from the idea]

## Proposed Solution

[High-level solution approach from the idea]

## Success Criteria

- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]
- [ ] [Measurable outcome 3]

## Scope

### In Scope
- [What's included]

### Out of Scope
- [What's explicitly excluded]

## Dependencies

- [External dependency 1]
- [Internal dependency 1]

## Related Documentation

- **Specification:** [Confluence page link]
- **Original Idea:** [JPD link]
- **Related Epics:** [Links if any]

## Open Questions

- [ ] [Question for delivery team to resolve]
- [ ] [Question for delivery team to resolve]

---
*This Epic was generated from JPD idea [IDEA_KEY] on [DATE]*
*Traceability: JPD → Epic → Spec established*
```

---

## Jira Description Format

Jira uses a wiki-style markup. Convert the template:

```
h2. Overview

[Idea summary]

h2. Origin

*Source:* [JPD Idea Link|https://jpd.atlassian.net/ideas/IDEA-123]
*Approved:* [Date]
*Champion:* [~accountid:USER_ID]

h2. Prioritization Context

|| Dimension || Score || Notes ||
| Impact | 8/10 | High customer demand |
| Effort | 5/10 | Moderate complexity |
| Confidence | 7/10 | Good evidence base |

*Overall Priority Score:* 7.2

h2. Customer Evidence

*Evidence Count:* 15 insights

h3. Key Themes

# *Theme 1* - Summary
# *Theme 2* - Summary

{quote}
"Customer quote here"
— Customer segment
{quote}

h2. Success Criteria

* [x] Outcome 1
* [ ] Outcome 2

h2. Related Documentation

* *Specification:* [Page Title|https://confluence.atlassian.net/...]
* *Original Idea:* [IDEA-123|https://jpd...]

----
_Generated from JPD idea IDEA-123_
```

---

## Minimal Version

For simpler handoffs, use this condensed format:

```markdown
## Overview
[One paragraph summary]

## Why Now
- Priority Score: [X]
- Evidence: [N] customer insights
- Key theme: [Primary customer need]

## Success Criteria
1. [Primary measurable outcome]
2. [Secondary outcome]

## Links
- Idea: [JPD link]
- Spec: [Confluence link]
```

---

## Field Mapping

When programmatically creating the Epic, map these fields:

| Epic Field | Source |
|------------|--------|
| Summary | Idea summary (may need truncation) |
| Description | Full template above |
| Labels | `from-jpd`, idea key, original idea labels |
| Epic Name | Idea summary (for classic Epic Name field) |
| Priority | Derive from idea score or set default |

---

## Tips

1. **Keep summaries scannable** - Delivery teams skim; lead with key info

2. **Quantify evidence** - "15 insights from 8 customers" is better than "lots of feedback"

3. **Preserve quotes** - 2-3 representative quotes make the need tangible

4. **Link, don't duplicate** - Reference the full spec; Epic is the summary

5. **Date the context** - Prioritization context ages; note when scores were set

6. **Call out unknowns** - Open questions prevent wasted exploration

---

## Example: Completed Epic Description

```
h2. Overview

Enable users to export dashboard data to CSV format for offline analysis and
reporting integration with external tools.

h2. Origin

*Source:* [JPD-142|https://jpd.atlassian.net/ideas/JPD-142]
*Approved:* 2024-01-15
*Champion:* [~accountid:5a123...]

h2. Prioritization Context

|| Dimension || Score ||
| Impact | 9/10 |
| Effort | 4/10 |
| Confidence | 8/10 |

*Overall Score:* 8.2 — High impact, moderate effort, strong evidence

h2. Customer Evidence

*15 insights* from enterprise customers

h3. Key Themes
# *Compliance reporting* - Need data exports for audit trails
# *External BI tools* - Want to combine with Tableau/PowerBI data

{quote}
"We spend 2 hours weekly manually copying data for our compliance reports"
— Enterprise Admin, Healthcare
{quote}

h2. Success Criteria

* [ ] Users can export any dashboard to CSV
* [ ] Export includes all visible data columns
* [ ] Export completes in <30 seconds for 10K rows

h2. Links

* *Spec:* [Dashboard Export - Specification|https://confluence...]
* *Original Idea:* [JPD-142|https://jpd...]

----
_Generated from JPD-142 on 2024-01-20_
```
