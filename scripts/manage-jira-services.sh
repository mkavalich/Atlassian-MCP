#!/bin/bash
# Shell script to manage all 6 JIRA MCP servers in production structure
# Usage: ./manage-jira-services.sh [build|stop|status|logs|test]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Define the 6 JIRA MCP services
JIRA_SERVICES=("jira-projects" "jira-workflows" "jira-fields-permissions" "jira-service-desk" "jira-organization" "jira-system-admin")

echo -e "${CYAN}JIRA MCP Servers Management Script (Production)${NC}"
echo -e "${CYAN}===============================================${NC}"

# Function to check if Docker is running
check_docker() {
    if ! docker info &> /dev/null; then
        echo -e "${RED}Docker is not running. Please start Docker.${NC}"
        exit 1
    fi
}

# Function to check if MCP network exists
check_mcp_network() {
    if ! docker network ls --filter name=mcp-network --format "{{.Name}}" | grep -q "mcp-network"; then
        echo -e "${YELLOW}Creating MCP network...${NC}"
        if docker network create mcp-network; then
            echo -e "${GREEN}MCP network created successfully${NC}"
        else
            echo -e "${RED}Failed to create MCP network${NC}"
            exit 1
        fi
    fi
}

# Function to load environment variables
load_env_file() {
    local env_file=""
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local service_env="$(dirname "$script_dir")/.env"
    local root_env="$(dirname "$(dirname "$script_dir")")/.env"
    
    # Try to find .env file
    if [[ -f "$service_env" ]]; then
        env_file="$service_env"
    elif [[ -f "$root_env" ]]; then
        env_file="$root_env"
    fi
    
    if [[ -n "$env_file" ]]; then
        echo -e "${CYAN}Loading environment variables from $env_file...${NC}"
        set -a  # automatically export all variables
        source "$env_file"
        set +a
    else
        echo -e "${YELLOW}No .env file found. Using system environment variables...${NC}"
    fi
}

# Function to validate environment variables
validate_jira_env() {
    load_env_file
    
    local required_vars=("JIRA_BASE_URL" "JIRA_EMAIL" "JIRA_API_TOKEN")
    local missing=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing+=("$var")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Missing required environment variables:${NC}"
        for var in "${missing[@]}"; do
            echo -e "   - $var"
        done
        echo -e "${YELLOW}Please check your .env file or set these variables.${NC}"
        return 1
    fi
    
    echo -e "${GREEN}All required JIRA environment variables are set${NC}"
    return 0
}

# Function to show service status
show_service_status() {
    echo -e "\n${CYAN}JIRA MCP Services Status:${NC}"
    echo -e "${CYAN}=============================${NC}"
    
    local root_dir="$(dirname "$(dirname "$(dirname "$PWD")")")"
    pushd "$root_dir" > /dev/null || exit 1
    
    for service in "${JIRA_SERVICES[@]}"; do
        local status
        status=$(docker-compose ps "$service" --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | tail -n +2)
        if [[ -n "$status" ]]; then
            if [[ "$status" == *"Up"* ]]; then
                echo -e "${GREEN}$service - $status${NC}"
            elif [[ "$status" == *"Exit"* ]]; then
                echo -e "${RED}$service - $status${NC}"
            else
                echo -e "${YELLOW}$service - $status${NC}"
            fi
        else
            echo -e "${CYAN}$service - Not running${NC}"
        fi
    done
    
    popd > /dev/null || exit 1
}

# Function to build all services
build_jira_services() {
    echo -e "\n${CYAN}Building all JIRA MCP servers...${NC}"
    
    local root_dir="$(dirname "$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")")"
    pushd "$root_dir" > /dev/null || exit 1
    
    for service in "${JIRA_SERVICES[@]}"; do
        echo -e "${YELLOW}Building $service...${NC}"
        if docker-compose build "$service"; then
            echo -e "${GREEN}$service built successfully${NC}"
        else
            echo -e "${RED}Failed to build $service${NC}"
            popd > /dev/null
            exit 1
        fi
    done
    
    popd > /dev/null || exit 1
    echo -e "${GREEN}All JIRA services built successfully!${NC}"
}

# Function to start all services
start_jira_services() {
    echo -e "\n${CYAN}Starting all JIRA MCP servers...${NC}"
    
    local root_dir="$(dirname "$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")")"
    pushd "$root_dir" > /dev/null || exit 1
    
    for service in "${JIRA_SERVICES[@]}"; do
        echo -e "${YELLOW}Starting $service...${NC}"
        if docker-compose up -d "$service"; then
            echo -e "${GREEN}$service started${NC}"
        else
            echo -e "${RED}Failed to start $service${NC}"
        fi
    done
    
    popd > /dev/null || exit 1
    
    echo -e "\n${YELLOW}Waiting for services to stabilize...${NC}"
    sleep 10
    
    show_service_status
}

# Function to stop all services
stop_jira_services() {
    echo -e "\n${CYAN}Stopping all JIRA MCP servers...${NC}"
    
    local root_dir="$(dirname "$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")")"
    pushd "$root_dir" > /dev/null || exit 1
    
    for service in "${JIRA_SERVICES[@]}"; do
        echo -e "${YELLOW}Stopping $service...${NC}"
        docker-compose stop "$service"
    done
    
    popd > /dev/null || exit 1
    echo -e "${GREEN}All JIRA services stopped${NC}"
}

# Function to show logs
show_jira_logs() {
    echo -e "\n${CYAN}Showing logs for all JIRA services...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit logs${NC}"
    
    local root_dir="$(dirname "$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")")"
    pushd "$root_dir" > /dev/null || exit 1
    
    docker-compose logs -f "${JIRA_SERVICES[@]}"
    
    popd > /dev/null || exit 1
}

# Function to test container connectivity
test_jira_connectivity() {
    echo -e "\n${CYAN}Testing JIRA MCP service connectivity...${NC}"
    
    for service in "${JIRA_SERVICES[@]}"; do
        local container_name="mcp-$service"
        echo -e "${YELLOW}Testing $container_name...${NC}"
        
        # Test if container is running
        if docker ps --filter "name=$container_name" --format "{{.Names}}" | grep -q "$container_name"; then
            echo -e "${GREEN}$container_name is running${NC}"
            
            # Test health check
            local health_status
            health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null)
            if [[ -n "$health_status" ]]; then
                if [[ "$health_status" == "healthy" ]]; then
                    echo -e "${GREEN}$container_name health check: $health_status${NC}"
                else
                    echo -e "${YELLOW}$container_name health check: $health_status${NC}"
                fi
            fi
        else
            echo -e "${RED}$container_name is not running${NC}"
        fi
    done
}

# Main execution logic
check_docker
check_mcp_network

case "${1:-start}" in
    "build")
        validate_jira_env || exit 1
        build_jira_services
        ;;
    "stop")
        stop_jira_services
        ;;
    "status")
        show_service_status
        ;;
    "logs")
        show_jira_logs
        ;;
    "test")
        test_jira_connectivity
        ;;
    "start"|"")
        if ! validate_jira_env; then
            echo -e "\n${CYAN}Tip: Copy .env.example to .env and configure your JIRA credentials${NC}"
            exit 1
        fi
        start_jira_services
        
        echo -e "\n${GREEN}All JIRA MCP servers are now running!${NC}"
        echo -e "\n${CYAN}Next steps:${NC}"
        echo -e "${WHITE}1. Check status: ./manage-jira-services.sh status${NC}"
        echo -e "${WHITE}2. View logs: ./manage-jira-services.sh logs${NC}"
        echo -e "${WHITE}3. Test connectivity: ./manage-jira-services.sh test${NC}"
        echo -e "${WHITE}4. Claude Desktop client configuration is already updated${NC}"
        echo -e "${WHITE}5. Stop servers: ./manage-jira-services.sh stop${NC}"
        
        echo -e "\n${CYAN}JIRA MCP Server Tool Summary:${NC}"
        echo -e "${WHITE}- jira-projects: 35 tools (projects, dashboards, reporting)${NC}"
        echo -e "${WHITE}- jira-workflows: 27 tools (workflows, screens)${NC}"
        echo -e "${WHITE}- jira-fields-permissions: 38 tools (fields, permissions)${NC}"
        echo -e "${WHITE}- jira-service-desk: 18 tools (JSM administration)${NC}"
        echo -e "${WHITE}- jira-organization: 17 tools (global organization)${NC}"
        echo -e "${WHITE}- jira-system-admin: 22 tools (system administration)${NC}"
        echo -e "${GREEN}   Total: 157 specialized JIRA administration tools${NC}"
        
        echo -e "\n${GREEN}Integration with main MCP network complete!${NC}"
        ;;
    *)
        echo -e "${RED}Usage: $0 [build|start|stop|status|logs|test]${NC}"
        exit 1
        ;;
esac