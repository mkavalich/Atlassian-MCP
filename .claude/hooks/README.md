# Claude Code Hooks for MCP Development Environment

This directory contains PowerShell hooks that provide safety controls for Claude Code in the MCP development environment. Hooks are designed to run silently during normal operation, only outputting messages when blocking destructive operations.

## Official Documentation

- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Get started with hooks](https://code.claude.com/docs/en/hooks-guide)

## Design Principles

1. **Silent Operation**: Hooks run silently on success - no verbose output cluttering the interface
2. **Block on Danger**: Only output error messages when blocking dangerous operations
3. **Fail Open**: If a hook errors, allow the operation to proceed rather than blocking
4. **Lightweight**: SessionStart hooks should be fast - no slow external commands

## Hook Files

### `session_start.ps1`
**Type:** SessionStart hook
**Purpose:** Provides minimal MCP environment context at session start

Per official Anthropic documentation:
- SessionStart hooks **do not use matchers** - they apply globally
- Output becomes context for Claude (stdout is added to conversation)
- Should be lightweight and fast
- Receives JSON input via stdin with: `session_id`, `transcript_path`, `cwd`, `source`, `agent_type`

### `validate_destructive.ps1`
**Type:** PreToolUse hook for Bash commands
**Purpose:** Prevents dangerous commands from executing

**Blocks:**
- System-level deletions (`rm -rf /`, `del /s /q E:\`, `format C:`)
- Docker nuclear options (`docker system prune -af`, `docker volume prune -f`)
- Git destructive operations (`git push --force`, major hard resets)
- Package management (`npm publish`, global uninstalls)
- MCP service destruction (`docker-compose down -v`, service config deletion)
- Bulk operations in critical directories (`services/`, `config/`, `.claude/`)
- Container compromise (privileged Docker operations)

### `validate_write.ps1`
**Type:** PreToolUse hook for Write operations
**Purpose:** Protects critical files from modification

**Protected Files:**
- Environment files (`.env*`, production configs)
- Container configurations (`docker-compose.yaml/yml`)
- Package management (`package.json`, `package-lock.json`)
- Claude settings (`.claude/settings.json`)
- Large files (>5MB to prevent memory issues)

### `format_code.ps1`
**Type:** PostToolUse hook for Edit/Write operations
**Purpose:** Silently formats code after edits

**Formatters (run silently if available):**
- Prettier for TS/JS/JSON/YAML/MD
- ESLint for JS/TS files
- Black for Python files
- isort for Python imports

### `validate_prepush.ps1`
**Type:** PreToolUse hook for git push commands
**Purpose:** Validates tools/skills sync and checks version/changelog consistency before push

**Validates:**
- Tool catalog is generated and up-to-date
- Skills pass validation against schema
- If package.json version changed, warns if CHANGELOG.md not updated

## Configuration

Hooks are configured in `.claude/settings.json`.

### Correct SessionStart Format (per official docs)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File \".claude\\hooks\\session_start.ps1\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Important:** SessionStart hooks do NOT use `matcher` fields - they apply globally.

### PreToolUse/PostToolUse Format

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File \".claude\\hooks\\validate_destructive.ps1\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

## Hook Communication Protocol

### Input (via stdin)

Hooks receive JSON input via stdin:

**SessionStart:**
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript",
  "cwd": "/current/working/directory",
  "source": "startup|resume|clear|compact",
  "agent_type": "optional"
}
```

**PreToolUse/PostToolUse:**
```json
{
  "session_id": "abc123",
  "tool_name": "Bash",
  "tool_input": { "command": "npm run build" }
}
```

### Exit Codes

- `0`: Allow operation to proceed (for SessionStart: add stdout to context)
- `2`: Block operation (shows error message to Claude)

## Environment Variables

| Variable | Description | Availability |
|----------|-------------|--------------|
| `CLAUDE_PROJECT_DIR` | Project root path | All hooks |
| `CLAUDE_ENV_FILE` | Path to persist environment variables | SessionStart only |
| `CLAUDE_EVENT_TYPE` | The hook event type | All hooks |
| `CLAUDE_TOOL_NAME` | Tool name | PreToolUse, PostToolUse |
| `CLAUDE_TOOL_INPUT` | Tool input JSON | PreToolUse, PostToolUse |

## Troubleshooting

### Hook Errors on Startup

If you see "SessionStart:startup hook error":

1. **Check configuration format**: SessionStart hooks should NOT have a `matcher` field
2. **Verify script path**: Ensure the PowerShell script exists at the configured path
3. **Test manually**:
   ```powershell
   echo '{"session_id":"test","cwd":".","source":"startup"}' | powershell -File .claude\hooks\session_start.ps1
   ```

### PowerShell Execution Policy

Run this once if scripts are blocked:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "hook error" on startup | `matcher` field in SessionStart | Remove `matcher` from SessionStart config |
| Timeout errors | Script takes too long | Increase `timeout` or simplify script |
| Empty output | Script not outputting to stdout | Use `Write-Output` (not `Write-Host`) |
| Variables empty | Expecting env vars | Read JSON from stdin instead |

## Best Practices

Per official Anthropic documentation:

1. **Keep SessionStart lightweight** - No slow external commands (avoid Docker checks)
2. **Output relevant context only** - Don't flood with verbose information
3. **Handle errors gracefully** - Use `2>$null` and try/catch blocks
4. **Use proper stdin parsing** - `[Console]::In.ReadToEnd()` for PowerShell
5. **Test independently** - Verify scripts work before integration
6. **Quote all variables** - Use `"$VAR"` not `$VAR`
