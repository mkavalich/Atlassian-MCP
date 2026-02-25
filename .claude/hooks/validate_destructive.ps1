# PowerShell hook to validate destructive commands for MCP development environment
param()

try {
    # Read JSON input from stdin using multiple methods for reliability
    $jsonInput = ""

    # Method 1: Try reading from pipeline input
    if ($input) {
        $jsonInput = $input | Out-String
    }

    # Method 2: Try Console.In if pipeline is empty
    if (-not $jsonInput -or $jsonInput.Trim() -eq "") {
        try {
            $reader = [System.Console]::In
            if ($reader) {
                $jsonInput = $reader.ReadToEnd()
            }
        } catch {
            # Console.In not available
        }
    }

    # Method 3: Try reading from stdin stream directly
    if (-not $jsonInput -or $jsonInput.Trim() -eq "") {
        try {
            $stdin = [System.Console]::OpenStandardInput()
            $reader = New-Object System.IO.StreamReader($stdin)
            $jsonInput = $reader.ReadToEnd()
            $reader.Close()
        } catch {
            # Stdin not available
        }
    }

    # If no input, exit gracefully (allow the operation)
    if (-not $jsonInput -or $jsonInput.Trim() -eq "") {
        exit 0
    }

    # Parse JSON
    $data = $null
    try {
        $data = $jsonInput | ConvertFrom-Json
    } catch {
        # JSON parsing failed, allow the operation
        exit 0
    }

    if (-not $data) {
        exit 0
    }

    # Extract the command from tool input
    $command = ""
    if ($data.tool_input -and $data.tool_input.command) {
        $command = $data.tool_input.command
    }

    if (-not $command) {
        exit 0
    }
    
    # Define destructive patterns to check for - enhanced for MCP environment
    $destructivePatterns = @(
        # System-level destruction
        'rm -rf /',
        'rm -rf E:/',
        'del /s /q E:\\',
        'rmdir /s /q E:\\',
        'Remove-Item.*-Recurse.*-Force.*E:\\',
        'format [a-zA-Z]:',
        'diskpart',
        'reg delete HKLM',
        'reg delete HKCR',
        'shutdown /s',
        'restart-computer -force',
        
        # Docker nuclear options
        'docker system prune.*-af',
        'docker volume prune.*-f',
        'docker rmi.*-f.*\$\(docker images -q\)',
        'docker container prune.*-f',
        'docker image prune.*-af',
        'docker network prune.*-f',
        
        # Package management destruction
        'npm publish',
        'npm uninstall.*-g',
        'pip uninstall.*-y.*-r requirements',
        
        # Git destructive operations
        'git push.*--force',
        'git reset.*--hard.*HEAD~[5-9]', # Allow small resets, block big ones
        'git branch -D main',
        'git branch -D master',
        'git checkout.*--force',
        
        # MCP service destruction
        'docker-compose down.*-v', # Removes volumes - dangerous for persistent data
        'docker exec.*rm -rf /app',
        'rm.*services/.*package\.json'
    )
    
    # Check if command matches any destructive pattern
    foreach ($pattern in $destructivePatterns) {
        if ($command -match $pattern) {
            Write-Error "🚫 Destructive command detected: '$command'"
            Write-Error "This command could damage the MCP development environment."
            Write-Error "Pattern matched: $pattern"
            exit 2
        }
    }
    
    # Additional checks for bulk operations in critical directories
    $criticalDirectories = @(
        'services/',
        'config/',
        '.claude/',
        'scripts/',
        '.git/'
    )
    
    $bulkOperations = @(
        'rm.*\*.*\*',      # rm with multiple wildcards
        'del.*\*.*\*',     # del with multiple wildcards  
        'Remove-Item.*\*.*\*'  # PowerShell with multiple wildcards
    )
    
    foreach ($bulkPattern in $bulkOperations) {
        if ($command -match $bulkPattern) {
            foreach ($dir in $criticalDirectories) {
                if ($command -like "*$dir*") {
                    Write-Error "🚫 Bulk operation in critical directory detected: '$dir'"
                    Write-Error "Command: '$command'"
                    Write-Error "Bulk operations in MCP service directories require manual confirmation."
                    exit 2
                }
            }
        }
    }
    
    # Check for dangerous Docker service operations
    $dangerousDockerOps = @(
        'docker-compose.*down.*--volumes',
        'docker exec.*-u root.*rm',
        'docker run.*--privileged.*rm',
        'docker.*--rm.*-v /:'
    )
    
    foreach ($pattern in $dangerousDockerOps) {
        if ($command -match $pattern) {
            Write-Error "🚫 Dangerous Docker operation detected: '$command'"
            Write-Error "This could compromise MCP service containers or host system."
            exit 2
        }
    }
    
    # Check for MCP server configuration tampering
    # Only check actual delete/remove commands, not git operations
    $mcpCriticalFiles = @(
        'docker-compose\.yaml',
        '\.env$',
        'services/.*/package\.json',
        'config/.*\.json'
    )

    # Skip this check for safe git operations
    $isSafeGitOp = $command -match '^git\s+(add|commit|status|diff|log|branch|checkout|push|pull|fetch|merge|rebase|stash|tag|show)\s'

    if (-not $isSafeGitOp -and $command -match '(^rm\s|^del\s|^Remove-Item\s|\brm -|\bdel /|Remove-Item\s)') {
        foreach ($pattern in $mcpCriticalFiles) {
            if ($command -match $pattern) {
                Write-Error "🚫 MCP critical file operation detected: '$command'"
                Write-Error "Pattern: $pattern"
                Write-Error "Critical MCP configuration files require manual handling."
                exit 2
            }
        }
    }
    
    # Command passed validation - exit silently
    exit 0

} catch {
    # Don't block on hook errors - exit silently
    exit 0
}