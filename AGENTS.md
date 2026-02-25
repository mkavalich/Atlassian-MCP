# Atlassian MCP Servers

> For AI agents working on this codebase. For agents USING these MCP tools, see [docs/agent-guide.md](docs/agent-guide.md).

## Build & Test

```bash
# Install dependencies (run in server directory)
npm install

# Build server
npm run build

# Development mode with watch
npm run dev

# Pre-push validation (run from project root)
npm run validate:all

# Regenerate tool catalog after adding/modifying tools
npm run generate:tool-catalog
```

## Code Conventions

- TypeScript strict mode, no `any` types
- Zod schemas with `.strict()` for all tool inputs
- Tool annotations required: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
- Error responses: `{ success: false, error: string, code: string, suggestion: string }`

## Project Structure

```
servers/<name>/src/index.ts   # Server entry point, tool registration
servers/<name>/src/tools/     # Tool implementations
.claude/skills/               # Claude Code skills
schemas/tools.json            # Auto-generated tool catalog
```

## Before Working On

| Task | Read First |
|------|------------|
| MCP tools | `.claude/skills/mcp-builder/SKILL.md` |
| Testing tools | `.claude/skills/tool-validation/SKILL.md` |
| Security review | `.claude/skills/security-audit/SKILL.md` |

## Commit Messages

Clear, descriptive messages preferred. Use prefix tags when helpful:
`[feature]`, `[fix]`, `[docs]`, `[refactor]`, `[test]`

For AI-assisted commits, include attribution:

```
Add pagination to search_projects tool

Co-Authored-By: Claude <noreply@anthropic.com>
```
