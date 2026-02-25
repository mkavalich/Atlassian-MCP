# Getting Started

## Prerequisites

- **Node.js 18+** - Required for building and running servers
- **Docker & Docker Compose** - Required for containerized deployment
- **Atlassian Cloud Account** - With admin access to generate API tokens

## Step 1: Generate API Tokens

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a descriptive name (e.g., "MCP Servers")
4. Copy the token (you won't be able to see it again)

## Step 2: Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
ATLASSIAN_SITE_URL=https://your-domain.atlassian.net
ATLASSIAN_USER_EMAIL=your-email@example.com
ATLASSIAN_API_TOKEN=your-api-token

# Required for jira-organization and jira-system-admin servers
ATLASSIAN_ORG_ID=your-organization-id
```

## Step 3: Start Servers

### Using Docker Compose (Recommended)

```bash
# Build all servers
docker-compose build

# Start all servers
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Running Individually (Development)

```bash
cd servers/jira-projects
npm install
npm run build
npm start
```

## Step 4: Configure MCP Clients

Configuration templates are provided in `config/clients/` for different platforms and use cases:

| File | Platform | Use Case |
|------|----------|----------|
| `claude-code-macos.json` | macOS/Linux | Claude Code development |
| `claude-code-windows.json` | Windows | Claude Code development |
| `claude-desktop-config.json` | Any (Docker) | Claude Desktop with Docker |

### Claude Code (CLI)

Copy the appropriate config for your platform to `.mcp.json` in the project root:

**macOS/Linux:**
```bash
cp config/clients/claude-code-macos.json .mcp.json
```

**Windows (PowerShell):**
```powershell
Copy-Item config/clients/claude-code-windows.json .mcp.json
```

Then start Claude Code from the project directory:
```bash
cd atlassian-mcp-servers
claude
```

Verify servers are loaded:
```bash
claude mcp list
```

> **Note:** The `.mcp.json` file is gitignored to prevent committing personal configurations.

#### Why different configs per platform?

On Windows, MCP servers that use `npx` require a `cmd /c` wrapper:
```json
{
  "command": "cmd",
  "args": ["/c", "npx", "tsx", "servers/jira-projects/src/index.ts"]
}
```

On macOS/Linux, `npx` can be called directly:
```json
{
  "command": "npx",
  "args": ["tsx", "servers/jira-projects/src/index.ts"]
}
```

### Claude Desktop

Claude Desktop configuration depends on whether you're using Docker or running servers directly.

#### Option A: Docker (Recommended for production)

1. Start the Docker containers:
   ```bash
   docker-compose up -d
   ```

2. Copy the Docker config to Claude Desktop's config location:

   **macOS:**
   ```bash
   cp config/clients/claude-desktop-config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

   **Windows (PowerShell):**
   ```powershell
   Copy-Item config/clients/claude-desktop-config.json $env:APPDATA\Claude\claude_desktop_config.json
   ```

3. Restart Claude Desktop

#### Option B: Direct (Development)

For development without Docker, copy the appropriate Claude Code config to Claude Desktop's config location, but use absolute paths:

**macOS:**
```json
{
  "mcpServers": {
    "jira-projects": {
      "command": "npx",
      "args": ["tsx", "/full/path/to/atlassian-mcp-servers/servers/jira-projects/src/index.ts"],
      "env": { "TRANSPORT": "stdio" }
    }
  }
}
```

**Windows:**
```json
{
  "mcpServers": {
    "jira-projects": {
      "command": "cmd",
      "args": ["/c", "cd", "/d", "/path/to/atlassian-mcp", "&&", "npx", "tsx", "servers/jira-projects/src/index.ts"],
      "env": { "TRANSPORT": "stdio" }
    }
  }
}
```

## Step 5: Verify Installation

Ask Claude: "Use search_tools to show me available Jira tools"

You should see a list of available tools organized by category.

## Troubleshooting

### Container won't start
- Check logs: `docker-compose logs jira-projects`
- Verify environment variables are set

### Authentication errors
- Verify API token is correct
- Check email matches the Atlassian account
- Ensure base URL doesn't have trailing slash

### Tool not found
- Run `search_tools` first to see available tools
- Check you're using the correct server for the tool

## Next Steps

- Read [Architecture](./architecture.md) to understand the system design
- Browse [Tool Catalog](./tool-catalog.md) for all available tools
- See [Optimization Guide](./optimization-guide.md) for deferred loading and tool use examples
- Check [Contributing](../CONTRIBUTING.md) to add new features
