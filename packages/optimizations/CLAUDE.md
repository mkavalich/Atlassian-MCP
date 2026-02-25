# Optimizations Package

## Response Formatter — Data-Driven Design

The response formatter (`hooks/response-formatter.ts`) converts tool responses from verbose JSON to compact TOON format, achieving ~50-60% token reduction.

### How It Works

**The formatter is fully data-driven. It requires zero configuration per tool.**

1. **Extract** — Finds the primary data array in any tool response by scanning for the largest array of objects, skipping known metadata keys (`success`, `pagination`, etc.)
2. **Detect fields** — Inspects the first few items in the array to discover which scalar fields exist, then ranks them by usefulness:
   - Tier 1: `id`, `key` (identifiers)
   - Tier 2: `name`, `title`, `displayName`, `summary` (labels)
   - Tier 3: `type`, `status`, `state`, `category` (classification)
   - Tier 4+: remaining scalar fields alphabetically
3. **Format** — Calls `toTOON()` from `@atlassian-mcp/shared` with the auto-detected fields
4. **Preserve metadata** — Appends `success`, `pagination`, `usage_guidance` etc. after the TOON output

### Why Data-Driven (Not Entity-Mapped)

A previous implementation used hardcoded entity type maps (`TOOL_ENTITY_MAP`) and regex-based tool name detection. This broke in two ways:
- Tools with compound names (e.g., `get_issue_types`) were misclassified by regex (`/issue/` matched → applied `issue` fields to issue type objects → all dashes)
- Response keys not in a hardcoded whitelist were silently skipped (e.g., `permissionSchemes`, `issueTypes`, `serviceDesks`)

**The current design has no whitelists, no entity maps, and no regex matching.** Adding a new tool requires zero changes to the formatter.

### Format Levels

| Format | Fields | Use Case |
|--------|--------|----------|
| `concise` (default) | Top 4 | List discovery, quick scans |
| `standard` | Top 8 | Detailed exploration |
| `detailed` | Passthrough | Full JSON, no transformation |

### Testing

When adding new tools, verify TOON output by calling the tool and checking:
- Fields in the header match actual data properties
- Values are populated (not all dashes)
- Metadata (pagination, usage_guidance) appears after `---`

If a tool returns a single object (not a list), the formatter passes through unchanged — TOON only applies to arrays.
