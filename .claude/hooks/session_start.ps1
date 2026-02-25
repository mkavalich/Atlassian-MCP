# PowerShell hook for session start - MCP Development Environment
# Per official Anthropic docs: SessionStart hooks receive JSON via stdin
# stdout -> Claude context, stderr -> terminal display

param()

# Read stdin JSON input (required by Claude Code hooks protocol)
# SessionStart input includes: session_id, transcript_path, cwd, source, agent_type
try {
    $inputJson = [Console]::In.ReadToEnd()
    if ($inputJson) {
        $hookInput = $inputJson | ConvertFrom-Json -ErrorAction SilentlyContinue
    }
} catch {
    # Silently continue if stdin parsing fails
}

# Output context for Claude (stdout) and terminal summary (stderr)
try {
    # Quick environment checks - keep it fast
    $envInfo = @()
    $gitStatus = ""
    $serverCount = 0

    # Git branch (fast check)
    $gitBranch = git branch --show-current 2>$null
    if ($gitBranch) {
        $changedCount = (git status --porcelain 2>$null | Measure-Object).Count
        if ($changedCount -gt 0) {
            $envInfo += "Git: $gitBranch ($changedCount uncommitted changes)"
            $gitStatus = "$gitBranch ($changedCount uncommitted)"
        } else {
            $envInfo += "Git: $gitBranch (clean)"
            $gitStatus = "$gitBranch (clean)"
        }
    }

    # Check for .env file
    if (Test-Path ".env") {
        $envInfo += "Environment: .env configured"
    }

    # Check MCP servers directory structure
    if (Test-Path "servers") {
        $serverCount = (Get-ChildItem "servers" -Directory | Measure-Object).Count
        $envInfo += "MCP Servers: $serverCount available"
    }

    # Output summary to Claude's context (stdout)
    if ($envInfo.Count -gt 0) {
        Write-Output "MCP Development Environment"
        Write-Output "==========================="
        $envInfo | ForEach-Object { Write-Output $_ }
    }

    # Output concise status to terminal (stderr)
    if ($gitStatus -and $serverCount -gt 0) {
        [Console]::Error.WriteLine([char]0x2713 + " $gitStatus | $serverCount MCP servers")
    }

    exit 0

} catch {
    # Per docs: fail gracefully, don't block session start
    exit 0
}
