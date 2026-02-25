# validate_prepush.ps1
# Runs before git push to ensure tools and skills are in sync

$ErrorActionPreference = "Stop"

# Consume stdin input (required by Claude Code hooks)
try {
    if ($input) {
        $null = $input | Out-String
    }
} catch {
    # Ignore stdin errors
}

Write-Host "🔍 Running pre-push validation..." -ForegroundColor Cyan

# Get the project root (where this script's parent .claude folder is)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

Push-Location $projectRoot

try {
    # Step 1: Generate tool catalog and schema
    Write-Host "  Generating tool catalog..." -ForegroundColor Gray
    $catalogResult = npm run generate:tool-catalog 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Tool catalog generation failed:" -ForegroundColor Red
        Write-Host $catalogResult -ForegroundColor Red
        exit 1
    }
    
    # Step 2: Validate skills against schema
    Write-Host "  Validating skills..." -ForegroundColor Gray
    $validateResult = npm run validate:skills 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Skill validation failed:" -ForegroundColor Red
        Write-Host $validateResult -ForegroundColor Red
        exit 1
    }
    
    # Step 3: Check for version changes without changelog updates
    Write-Host "  Checking version/changelog sync..." -ForegroundColor Gray
    
    # Get staged files
    $stagedFiles = git diff --cached --name-only 2>$null
    
    # Check if any package.json was modified
    $packageJsonChanged = $stagedFiles | Where-Object { $_ -match "package\.json$" }
    
    if ($packageJsonChanged) {
        # Check if version field changed in any package.json
        foreach ($pkg in $packageJsonChanged) {
            $versionDiff = git diff --cached -U0 $pkg 2>$null | Select-String '"version"'
            if ($versionDiff) {
                # Version changed - check if CHANGELOG also changed
                $changelogDir = Split-Path -Parent $pkg
                $changelogPath = if ($changelogDir) { "$changelogDir/CHANGELOG.md" } else { "CHANGELOG.md" }
                
                $changelogChanged = $stagedFiles | Where-Object { $_ -eq $changelogPath -or $_ -eq "CHANGELOG.md" }
                
                if (-not $changelogChanged) {
                    Write-Host "" -ForegroundColor Yellow
                    Write-Host "⚠️  VERSION SYNC WARNING" -ForegroundColor Yellow
                    Write-Host "   Version changed in: $pkg" -ForegroundColor Yellow
                    Write-Host "   But no CHANGELOG.md update detected." -ForegroundColor Yellow
                    Write-Host "" -ForegroundColor Yellow
                    # Warning only, don't block
                }
            }
        }
    }
    
    Write-Host "✅ Pre-push validation passed" -ForegroundColor Green
    exit 0
}
catch {
    Write-Host "❌ Validation error: $_" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
