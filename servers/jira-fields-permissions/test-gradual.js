#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { AuthConfig } from './dist/types/index.js';
import { AuthManager } from './dist/auth/index.js';
import { JiraApiClient } from './dist/api/client.js';

// Load environment variables
dotenv.config();

// Create and configure the MCP server
const server = new McpServer({
  name: 'jira-admin-mcp-server',
  version: '1.0.0',
  description: 'MCP server for Jira administration via Atlassian Cloud REST APIs',
});

async function initializeServer() {
  try {
    // Configure authentication
    const authConfig = {
      type: 'basic',
      baseUrl: process.env.JIRA_BASE_URL || '',
      email: process.env.JIRA_EMAIL || '',
      apiToken: process.env.JIRA_API_TOKEN || '',
    };

    // Initialize auth manager and API client
    const authManager = new AuthManager(authConfig);
    const apiClient = new JiraApiClient(authManager);

    console.error('Auth and API client initialized successfully');

    // Try to import and register just one tool to test
    try {
      const { registerSystemTools } = await import('./dist/tools/system.js');
      await registerSystemTools(server, apiClient);
      console.error('System tools registered successfully');
    } catch (error) {
      console.error('Error registering system tools:', error.message);
      throw error;
    }

    // Create and connect transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('Server connected successfully');

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