#!/usr/bin/env pwsh
# Comprehensive health monitoring script for Jira MCP servers
# Usage: .\health-monitor.ps1 [-Continuous] [-LogFile <path>]

param(
    [switch]$Continuous,      # Run continuously with intervals
    [string]$LogFile = "",    # Optional log file path
    [int]$Interval = 30       # Monitoring interval in seconds
)

# Define the 6 Jira MCP services
$JiraServices = @(
    "jira-projects",
    "jira-workflows", 
    "jira-fields-permissions",
    "jira-service-desk",
    "jira-organization",
    "jira-system-admin"
)

$ContainerNames = @{
    "jira-projects" = "mcp-jira-projects"
    "jira-workflows" = "mcp-jira-workflows"
    "jira-fields-permissions" = "mcp-jira-fields-permissions"
    "jira-service-desk" = "mcp-jira-service-desk"
    "jira-organization" = "mcp-jira-organization"
    "jira-system-admin" = "mcp-jira-system-admin"
}

# Function to log messages
function Write-LogMessage {
    param([string]$Message, [string]$Level = "INFO")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Color coding for console
    switch ($Level) {
        "ERROR" { Write-Host $logEntry -ForegroundColor Red }
        "WARN" { Write-Host $logEntry -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $logEntry -ForegroundColor Green }
        default { Write-Host $logEntry -ForegroundColor White }
    }
    
    # Write to log file if specified
    if ($LogFile) {
        Add-Content -Path $LogFile -Value $logEntry
    }
}

# Function to test MCP communication for a specific service
function Test-MCPCommunication {
    param([string]$ServiceName, [string]$ContainerName)
    
    try {
        # Test basic MCP protocol with initialize message
        $initMessage = @{
            jsonrpc = "2.0"
            method = "initialize"
            params = @{
                capabilities = @{}
            }
            id = 1
        } | ConvertTo-Json -Compress
        
        $result = echo $initMessage | docker exec -i $ContainerName node /app/dist/index.js 2>&1
        
        if ($result -match "jsonrpc") {
            Write-LogMessage "MCP communication test PASSED for $ServiceName" "SUCCESS"
            return $true
        } else {
            Write-LogMessage "MCP communication test FAILED for $ServiceName - No valid JSON-RPC response" "ERROR"
            return $false
        }
    } catch {
        Write-LogMessage "MCP communication test FAILED for $ServiceName - Exception: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Function to get container resource usage
function Get-ContainerStats {
    param([string]$ContainerName)
    
    try {
        $stats = docker stats $ContainerName --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" | Select-Object -Skip 1
        if ($stats) {
            $statsParts = $stats -split '\s+'
            return @{
                CPU = $statsParts[0]
                Memory = $statsParts[1]
                Network = $statsParts[2]
                BlockIO = $statsParts[3]
            }
        }
    } catch {
        Write-LogMessage "Failed to get stats for $ContainerName - $($_.Exception.Message)" "ERROR"
    }
    
    return @{
        CPU = "N/A"
        Memory = "N/A"
        Network = "N/A"
        BlockIO = "N/A"
    }
}

# Function to perform comprehensive health check
function Invoke-HealthCheck {
    Write-LogMessage "=== Starting Comprehensive Health Check ===" "INFO"
    
    # Check Docker daemon
    try {
        docker info | Out-Null
        Write-LogMessage "Docker daemon is running" "SUCCESS"
    } catch {
        Write-LogMessage "Docker daemon is not accessible" "ERROR"
        return
    }
    
    # Check MCP network
    $mcpNetwork = docker network ls --filter name=mcp-network --format "{{.Name}}"
    if ($mcpNetwork -eq "mcp-network") {
        Write-LogMessage "MCP network exists" "SUCCESS"
    } else {
        Write-LogMessage "MCP network is missing" "ERROR"
    }
    
    # Overall health summary
    $healthySvcs = 0
    $totalSvcs = $JiraServices.Count
    
    Write-LogMessage "Checking individual service health..." "INFO"
    Write-LogMessage "-" * 80 "INFO"
    
    foreach ($service in $JiraServices) {
        $containerName = $ContainerNames[$service]
        
        # Get container status
        $containerInfo = docker ps -a --filter name=$containerName --format "{{.Status}}"
        
        Write-LogMessage "Service: $service ($containerName)" "INFO"
        Write-LogMessage "  Status: $containerInfo" "INFO"
        
        # Check if container is in restart loop (this is expected for MCP servers)
        if ($containerInfo -match "Restarting") {
            Write-LogMessage "  Health: MCP server ready (restart pattern is expected)" "SUCCESS"
            
            # Test MCP communication if container allows it
            try {
                $mcpTest = Test-MCPCommunication -ServiceName $service -ContainerName $containerName
                if ($mcpTest) {
                    $healthySvcs++
                    Write-LogMessage "  MCP Protocol: WORKING" "SUCCESS"
                } else {
                    Write-LogMessage "  MCP Protocol: ISSUES DETECTED" "WARN"
                }
            } catch {
                Write-LogMessage "  MCP Protocol: Cannot test during restart cycle" "WARN"
            }
            
        } elseif ($containerInfo -match "Up") {
            Write-LogMessage "  Health: Running normally" "SUCCESS"
            $mcpTest = Test-MCPCommunication -ServiceName $service -ContainerName $containerName
            if ($mcpTest) {
                $healthySvcs++
                Write-LogMessage "  MCP Protocol: WORKING" "SUCCESS"
            }
        } else {
            Write-LogMessage "  Health: NOT RUNNING" "ERROR"
            Write-LogMessage "  MCP Protocol: UNAVAILABLE" "ERROR"
        }
        
        # Get resource usage
        $stats = Get-ContainerStats -ContainerName $containerName
        Write-LogMessage "  CPU: $($stats.CPU) | Memory: $($stats.Memory) | Network: $($stats.Network)" "INFO"
        
        Write-LogMessage "" "INFO"
    }
    
    Write-LogMessage "-" * 80 "INFO"
    Write-LogMessage "Health Summary: $healthySvcs/$totalSvcs services operational" "INFO"
    
    if ($healthySvcs -eq $totalSvcs) {
        Write-LogMessage "All Jira MCP servers are healthy!" "SUCCESS"
    } elseif ($healthySvcs -gt ($totalSvcs / 2)) {
        Write-LogMessage "Most Jira MCP servers are healthy, some issues detected" "WARN"
    } else {
        Write-LogMessage "Critical: Multiple Jira MCP servers have issues" "ERROR"
    }
    
    Write-LogMessage "=== Health Check Complete ===" "INFO"
    Write-LogMessage "" "INFO"
}

# Function to create monitoring dashboard data
function Export-MonitoringData {
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $dataFile = "monitoring_data_$timestamp.json"
    
    $monitoringData = @{
        timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
        services = @()
    }
    
    foreach ($service in $JiraServices) {
        $containerName = $ContainerNames[$service]
        $containerInfo = docker inspect $containerName | ConvertFrom-Json
        $stats = Get-ContainerStats -ContainerName $containerName
        
        $serviceData = @{
            name = $service
            container = $containerName
            status = $containerInfo.State.Status
            running = $containerInfo.State.Running
            restartCount = $containerInfo.RestartCount
            startedAt = $containerInfo.State.StartedAt
            health = $containerInfo.State.Health.Status
            resources = $stats
        }
        
        $monitoringData.services += $serviceData
    }
    
    $monitoringData | ConvertTo-Json -Depth 5 | Out-File -FilePath $dataFile
    Write-LogMessage "Monitoring data exported to: $dataFile" "INFO"
}

# Main execution
Write-LogMessage "Jira MCP Servers Health Monitor" "INFO"
Write-LogMessage "================================" "INFO"

if ($Continuous) {
    Write-LogMessage "Starting continuous monitoring (interval: $Interval seconds)" "INFO"
    Write-LogMessage "Press Ctrl+C to stop monitoring" "INFO"
    
    try {
        while ($true) {
            Invoke-HealthCheck
            Export-MonitoringData
            
            Write-LogMessage "Waiting $Interval seconds before next check..." "INFO"
            Start-Sleep -Seconds $Interval
        }
    } catch {
        Write-LogMessage "Monitoring stopped: $($_.Exception.Message)" "INFO"
    }
} else {
    # Single health check
    Invoke-HealthCheck
    Export-MonitoringData
}

Write-LogMessage "Health monitoring session ended" "INFO"