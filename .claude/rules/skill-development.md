---
paths:
  - .claude/skills/**/*.md
  - .claude/skills/**/*.yaml
---

# Skill Development Rules

## Creating a New Skill

1. Create a directory in `.claude/skills/` with your skill name
2. Copy `.claude/skills/metadata.template.yaml` to `metadata.yaml`
3. Create `SKILL.md` with the skill content
4. List all referenced tools in `metadata.yaml`

## Tool References

When referencing MCP tools in skill content:

- Use exact tool names from `schemas/tools.json`
- Wrap tool names in backticks: `jira_create_project`
- Add all referenced tools to `metadata.yaml` under `tools_used`

## Validation

Before committing skill changes:

```bash
npm run validate:skills
```

This checks that all tools referenced in skills actually exist.

## metadata.yaml Structure

```yaml
name: skill-name              # Required: matches directory name
description: What it does     # Required: brief description
version: 1.0.0               # Optional: semantic version

tools_used:                   # Required: list all tools mentioned
  - jira_create_project
  - jira_get_issue

target_servers:               # Optional: which servers this works with
  - jira-projects

extends: []                   # Optional: parent skills
tags: []                      # Optional: categorization
```

## SKILL.md Guidelines

- Start with a clear purpose statement
- Document when to use vs. not use the skill
- Include concrete examples
- Reference tools by exact name
- Keep instructions actionable

## Pre-Push Hook

A hook automatically validates skills before `git push`:

1. Generates fresh `schemas/tools.json` from servers
2. Scans all skills for tool references
3. Fails push if any referenced tool doesn't exist

This prevents skills from referencing renamed/removed tools.
