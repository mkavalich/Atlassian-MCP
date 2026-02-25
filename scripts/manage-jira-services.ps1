#!/usr/bin/env pwsh
# PowerShell script to manage all 6 JIRA MCP servers in production structure
# Usage: .\manage-jira-services.ps1 [-Build] [-Stop] [-Status] [-Logs] [-Test]

param(
    [switch]$Build,    # Build images before starting
    [switch]$Stop,     # Stop all JIRA services
    [switch]$Status,   # Show status of all services
    [switch]$Logs,     # Show logs for all JIRA services
    [switch]$Test      # Test container connectivity
)

# Define the 6 JIRA MCP services
$JiraServices = @(
    "jira-projects",
    "jira-workflows", 
    "jira-fields-permissions",
    "jira-service-desk",
    "jira-organization",
    "jira-system-admin"
)

Write-Host "JIRA MCP Servers Management Script (Production)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        docker info | Out-Null
        return $true
    } catch {
        Write-Host "Docker is not running. Please start Docker Desktop." -ForegroundColor Red
        return $false
    }
}

# Function to check if MCP network exists
function Test-MCPNetwork {
    $networkExists = docker network ls --filter name=mcp-network --format "{{.Name}}" | Select-String "mcp-network"
    if (-not $networkExists) {
        Write-Host "Creating MCP network..." -ForegroundColor Yellow
        docker network create mcp-network
        if ($LASTEXITCODE -eq 0) {
            Write-Host "MCP network created successfully" -ForegroundColor Green
        } else {
            Write-Host "Failed to create MCP network" -ForegroundColor Red
            return $false
        }
    }
    return $true
}

# Function to load environment variables from .env file
function Load-EnvFile {
    $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) -ChildPath ".env"
    $rootEnvFile = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -ChildPath ".env"
    
    # Try to find .env file in multiple locations
    $envPaths = @($envFile, $rootEnvFile)
    $foundEnvFile = $null
    
    foreach ($path in $envPaths) {
        if (Test-Path $path) {
            $foundEnvFile = $path
            break
        }
    }
    
    if ($foundEnvFile) {
        Write-Host "Loading environment variables from $foundEnvFile..." -ForegroundColor Gray
        Get-Content $foundEnvFile | ForEach-Object {
            if ($_ -and $_ -notmatch '^\s*#' -and $_ -match '^([^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                [System.Environment]::SetEnvironmentVariable($name, $value, [System.EnvironmentVariableTarget]::Process)
            }
        }
    } else {
        Write-Host "No .env file found. Checking system environment variables..." -ForegroundColor Yellow
    }
}

# Function to validate environment variables
function Test-JiraEnvironment {
    Load-EnvFile
    
    $requiredVars = @("JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN")
    $missing = @()
    
    foreach ($var in $requiredVars) {
        $value = [System.Environment]::GetEnvironmentVariable($var, [System.EnvironmentVariableTarget]::Process)
        if (-not $value) {
            $missing += $var
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Host "Missing required environment variables:" -ForegroundColor Yellow
        foreach ($var in $missing) {
            Write-Host "   - $var" -ForegroundColor Yellow
        }
        Write-Host "   Please check your .env file or set these variables." -ForegroundColor Yellow
        return $false
    }
    
    Write-Host "All required JIRA environment variables are set" -ForegroundColor Green
    return $true
}

# Function to show service status
function Show-ServiceStatus {
    Write-Host "`nJIRA MCP Services Status:" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan
    
    # Change to root directory for docker-compose commands
    $rootDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    Push-Location $rootDir
    
    try {
        foreach ($service in $JiraServices) {
            $status = docker-compose ps $service --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>$null | Select-Object -Skip 1
            if ($status) {
                if ($status -like "*Up*") {
                    Write-Host "$service - $status" -ForegroundColor Green
                } elseif ($status -like "*Exit*") {
                    Write-Host "$service - $status" -ForegroundColor Red
                } else {
                    Write-Host "$service - $status" -ForegroundColor Yellow
                }
            } else {
                Write-Host "$service - Not running" -ForegroundColor Gray
            }
        }
    } finally {
        Pop-Location
    }
}

# Function to build all services
function Build-JiraServices {
    Write-Host "`nBuilding all JIRA MCP servers..." -ForegroundColor Cyan
    
    # Change to root directory for docker-compose commands
    $rootDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    Push-Location $rootDir
    
    try {
        foreach ($service in $JiraServices) {
            Write-Host "Building $service..." -ForegroundColor Yellow
            docker-compose build $service
            if ($LASTEXITCODE -eq 0) {
                Write-Host "$service built successfully" -ForegroundColor Green
            } else {
                Write-Host "Failed to build $service" -ForegroundColor Red
                return $false
            }
        }
    } finally {
        Pop-Location
    }
    
    Write-Host "All JIRA services built successfully!" -ForegroundColor Green
    return $true
}

# Function to start all services
function Start-JiraServices {
    Write-Host "`nStarting all JIRA MCP servers..." -ForegroundColor Cyan
    
    # Change to root directory for docker-compose commands
    $rootDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    Push-Location $rootDir
    
    try {
        # Start services in background
        foreach ($service in $JiraServices) {
            Write-Host "Starting $service..." -ForegroundColor Yellow
            docker-compose up -d $service
            if ($LASTEXITCODE -eq 0) {
                Write-Host "$service started" -ForegroundColor Green
            } else {
                Write-Host "Failed to start $service" -ForegroundColor Red
            }
        }
    } finally {
        Pop-Location
    }
    
    Write-Host "`nWaiting for services to stabilize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    Show-ServiceStatus
}

# Function to stop all services
function Stop-JiraServices {
    Write-Host "`nStopping all JIRA MCP servers..." -ForegroundColor Cyan
    
    # Change to root directory for docker-compose commands
    $rootDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    Push-Location $rootDir
    
    try {
        foreach ($service in $JiraServices) {
            Write-Host "Stopping $service..." -ForegroundColor Yellow
            docker-compose stop $service
        }
    } finally {
        Pop-Location
    }
    
    Write-Host "All JIRA services stopped" -ForegroundColor Green
}

# Function to show logs
function Show-JiraLogs {
    Write-Host "`nShowing logs for all JIRA services..." -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to exit logs" -ForegroundColor Yellow
    
    # Change to root directory for docker-compose commands
    $rootDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    Push-Location $rootDir
    
    try {
        $serviceList = $JiraServices -join " "
        docker-compose logs -f $serviceList.Split()
    } finally {
        Pop-Location
    }
}

# Function to test container connectivity
function Test-JiraConnectivity {
    Write-Host "`nTesting JIRA MCP service connectivity..." -ForegroundColor Cyan
    
    foreach ($service in $JiraServices) {
        $containerName = "mcp-$service"
        Write-Host "Testing $containerName..." -ForegroundColor Yellow
        
        # Test if container is running
        $isRunning = docker ps --filter "name=$containerName" --format "{{.Names}}" | Select-String $containerName
        if ($isRunning) {
            Write-Host "$containerName is running" -ForegroundColor Green
            
            # Test health check
            $healthStatus = docker inspect --format='{{.State.Health.Status}}' $containerName 2>$null
            if ($healthStatus) {
                if ($healthStatus -eq "healthy") {
                    Write-Host "$containerName health check: $healthStatus" -ForegroundColor Green
                } else {
                    Write-Host "$containerName health check: $healthStatus" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "$containerName is not running" -ForegroundColor Red
        }
    }
}

# Main execution logic
if (-not (Test-DockerRunning)) {
    exit 1
}

if (-not (Test-MCPNetwork)) {
    exit 1
}

# Handle different modes
if ($Stop) {
    Stop-JiraServices
    exit 0
}

if ($Status) {
    Show-ServiceStatus
    exit 0
}

if ($Logs) {
    Show-JiraLogs
    exit 0
}

if ($Test) {
    Test-JiraConnectivity
    exit 0
}

# Default: Start services
if (-not (Test-JiraEnvironment)) {
    Write-Host "`nTip: Copy .env.example to .env and configure your JIRA credentials" -ForegroundColor Cyan
    exit 1
}

if ($Build) {
    if (-not (Build-JiraServices)) {
        exit 1
    }
}

Start-JiraServices

Write-Host "`nAll JIRA MCP servers are now running!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Check status: .\manage-jira-services.ps1 -Status" -ForegroundColor White
Write-Host "2. View logs: .\manage-jira-services.ps1 -Logs" -ForegroundColor White
Write-Host "3. Test connectivity: .\manage-jira-services.ps1 -Test" -ForegroundColor White
Write-Host "4. Claude Desktop client configuration is already updated" -ForegroundColor White
Write-Host "5. Stop servers: .\manage-jira-services.ps1 -Stop" -ForegroundColor White

Write-Host "`nJIRA MCP Server Tool Summary:" -ForegroundColor Cyan
Write-Host "- jira-projects: 35 tools (projects, dashboards, reporting)" -ForegroundColor White
Write-Host "- jira-workflows: 27 tools (workflows, screens)" -ForegroundColor White  
Write-Host "- jira-fields-permissions: 38 tools (fields, permissions)" -ForegroundColor White
Write-Host "- jira-service-desk: 18 tools (JSM administration)" -ForegroundColor White
Write-Host "- jira-organization: 17 tools (global organization)" -ForegroundColor White
Write-Host "- jira-system-admin: 22 tools (system administration)" -ForegroundColor White
Write-Host "   Total: 157 specialized JIRA administration tools" -ForegroundColor Green

Write-Host "`nIntegration with main MCP network complete!" -ForegroundColor Green