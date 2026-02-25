# PowerShell hook to validate write operations for MCP development environment
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

    # Extract file path from tool input
    $filePath = ""
    if ($data.tool_input -and $data.tool_input.path) {
        $filePath = $data.tool_input.path
    } elseif ($data.tool_input -and $data.tool_input.file_path) {
        $filePath = $data.tool_input.file_path
    }

    if (-not $filePath) {
        exit 0
    }
    
    # Define protected files/patterns specific to MCP development environment
    $protectedPatterns = @(
        # Environment and secrets
        '^\.env$',
        '\.env\..*',
        '\.env\.production$',
        
        # Critical container configurations  
        '^docker-compose\.yaml$',
        '^docker-compose\.yml$',
        'docker-compose\.prod\.ya?ml$',
        
        # Package management files
        'package\.json$',
        'package-lock\.json$',
        'yarn\.lock$',
        'requirements\.txt$',
        'Pipfile\.lock$',
        
        # Critical system directories
        'node_modules\\',
        '\.git\\(?!hooks)', # Protect .git but allow .git/hooks
        'System32\\',
        'Program Files\\',
        'Windows\\',
        
        # Claude Code configuration (protect main settings)
        '\.claude\\settings\.json$',
        
        # MCP server deployment configs
        'services/.*/Dockerfile$',
        'config/.*\.json$',
        
        # Security and test configurations
        'config/security/.*\.json$',
        '.github/workflows/.*\.ya?ml$'
    )
    
    # Check if writing to protected file
    foreach ($pattern in $protectedPatterns) {
        if ($filePath -match $pattern) {
            Write-Error "🚫 Write to protected file blocked: '$filePath'"
            Write-Error "Pattern matched: $pattern"
            Write-Error "This file is critical to the MCP development environment."
            Write-Error "Please edit manually or use appropriate deployment procedures."
            exit 2
        }
    }
    
    # Check for large file writes (> 5MB content) - MCP servers can generate large logs
    if ($data.tool_input.content -and $data.tool_input.content.Length -gt 5242880) {
        Write-Error "🚫 Large file write blocked (>5MB): '$filePath'"
        Write-Error "Large file operations in MCP environment require manual confirmation."
        Write-Error "This prevents accidental memory issues or log flooding."
        exit 2
    }
    
    # Write operation passed validation - exit silently
    exit 0

} catch {
    # Don't block on hook errors - exit silently
    exit 0
}