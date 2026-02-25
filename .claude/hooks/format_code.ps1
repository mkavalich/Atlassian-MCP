# PowerShell hook to format code after edits - Silent operation mode
# Only outputs on errors to keep the interface clean
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

    # If no input, exit gracefully
    if (-not $jsonInput -or $jsonInput.Trim() -eq "") {
        exit 0
    }

    # Parse JSON
    $data = $null
    try {
        $data = $jsonInput | ConvertFrom-Json
    } catch {
        # JSON parsing failed, exit gracefully
        exit 0
    }

    if (-not $data) {
        exit 0
    }

    # Get file paths that were modified
    $filePaths = @()

    # Handle different tool input structures
    if ($data.tool_input -and $data.tool_input.path) {
        $filePaths += $data.tool_input.path
    }
    if ($data.tool_input -and $data.tool_input.file_path) {
        $filePaths += $data.tool_input.file_path
    }
    if ($data.tool_input -and $data.tool_input.files) {
        $filePaths += $data.tool_input.files | ForEach-Object { $_.path }
    }

    # Also check environment variable if available
    if ($env:CLAUDE_FILE_PATHS) {
        $filePaths += $env:CLAUDE_FILE_PATHS -split ','
    }

    if (-not $filePaths -or $filePaths.Count -eq 0) {
        exit 0
    }

    # Filter for files that should be formatted
    $formattableExtensions = @('.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml', '.py')
    $filesToFormat = @()

    foreach ($file in $filePaths) {
        $file = $file.Trim()
        if (-not $file) { continue }

        # Check if file exists and has formattable extension
        if (Test-Path $file) {
            $extension = [System.IO.Path]::GetExtension($file)
            if ($extension -in $formattableExtensions) {
                $filesToFormat += $file
            }
        }
    }

    if ($filesToFormat.Count -eq 0) {
        exit 0
    }

    # Run Prettier if available (for TS/JS/JSON/YAML/MD) - silently
    $prettierAvailable = Get-Command "prettier" -ErrorAction SilentlyContinue
    if ($prettierAvailable) {
        $prettierFiles = $filesToFormat | Where-Object { $_ -match '\.(js|jsx|ts|tsx|json|md|ya?ml)$' }
        foreach ($file in $prettierFiles) {
            & prettier --write $file 2>$null | Out-Null
        }
    }

    # Run ESLint if available for JS/TS files - silently
    $eslintAvailable = Get-Command "eslint" -ErrorAction SilentlyContinue
    if ($eslintAvailable) {
        $jsFiles = $filesToFormat | Where-Object { $_ -match '\.(js|jsx|ts|tsx)$' }
        foreach ($file in $jsFiles) {
            & eslint --fix $file 2>$null | Out-Null
        }
    }

    # Run Black formatter if available for Python files - silently
    $blackAvailable = Get-Command "black" -ErrorAction SilentlyContinue
    if ($blackAvailable) {
        $pythonFiles = $filesToFormat | Where-Object { $_ -match '\.py$' }
        foreach ($file in $pythonFiles) {
            & black $file 2>$null | Out-Null
        }
    }

    # Run isort if available for Python imports - silently
    $isortAvailable = Get-Command "isort" -ErrorAction SilentlyContinue
    if ($isortAvailable) {
        $pythonFiles = $filesToFormat | Where-Object { $_ -match '\.py$' }
        foreach ($file in $pythonFiles) {
            & isort $file 2>$null | Out-Null
        }
    }

    exit 0

} catch {
    # Don't fail the operation on formatting errors - just exit silently
    exit 0
}
