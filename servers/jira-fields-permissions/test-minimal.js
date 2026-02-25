#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Create a minimal MCP server for testing
const server = new McpServer({
  name: 'jira-admin-mcp-server',
  version: '1.0.0',
  description: 'MCP server for Jira administration via Atlassian Cloud REST APIs',
});

async function initializeServer() {
  try {
    // Create and connect transport without any tools
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await server.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start the server
initializeServer().catch((error) => {
  console.error('Unhandled error during initialization:', error);
  process.exit(1);
});