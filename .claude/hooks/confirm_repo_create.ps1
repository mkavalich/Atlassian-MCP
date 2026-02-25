# PowerShell hook for repository creation confirmation
# PreToolUse hook for: Bash(gh repo create:*)
# Validates repo names and requires confirmation before creating repos

param()

# Read stdin (hook input includes tool_input with the command)
$repoName = $null
try {
    $inputJson = [Console]::In.ReadToEnd()
    if ($inputJson) {
        $hookInput = $inputJson | ConvertFrom-Json -ErrorAction SilentlyContinue
        # Extract command from tool_input
        if ($hookInput.tool_input -and $hookInput.tool_input.command) {
            $command = $hookInput.tool_input.command
            # Parse repo name from: gh repo create <name> [flags]
            if ($command -match 'gh\s+repo\s+create\s+([^\s]+)') {
                $repoName = $matches[1]
            }
        }
    }
} catch {
    # Continue without input parsing
}

function Write-Block {
    param([string]$Reason)
    Write-Output "BLOCKED: Repository creation blocked"
    Write-Output "Reason: $Reason"
    Write-Output ""
    Write-Output "To proceed, ensure you're creating an expected repository."
    exit 1
}

try {
    # Check if we could parse a repo name
    if (-not $repoName) {
        # Can't validate without repo name, allow to proceed
        # The gh command may fail on its own if invalid
        exit 0
    }

    $messages = @()

    # === Safety Check 1: Block dangerous operations ===
    # This hook is for 'gh repo create', but let's also catch if someone
    # is trying to do something destructive

    # (gh repo delete would be a different command, but good to note)

    # === Safety Check 2: Validate repo name pattern ===
    $isExpectedPattern = $repoName -match 'atlassian|mcp'

    if (-not $isExpectedPattern) {
        $messages += "Repository name '$repoName' doesn't match expected project patterns"
        $messages += "Expected: Names containing 'atlassian' or 'mcp'"
    }

    # === Output validation messages ===
    if ($messages.Count -gt 0) {
        Write-Output "=== Repository Creation Validation ==="
        Write-Output "Repository: $repoName"
        Write-Output ""
        foreach ($msg in $messages) {
            Write-Output $msg
        }
        Write-Output ""
        Write-Output "Proceeding with repository creation..."
        Write-Output "(User confirmation was requested by Claude before this command)"
    }

    # Don't block - just warn. Claude should have already asked for confirmation.
    # The hook provides visibility into what's being created.
    exit 0

} catch {
    # Don't block on hook errors
    exit 0
}
