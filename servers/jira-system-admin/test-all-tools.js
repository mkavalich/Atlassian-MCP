#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
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

    // Try to register all tools one by one to identify any failures
    const toolModules = [
      { name: 'projects', module: './dist/tools/projects.js', register: 'registerProjectTools' },
      { name: 'system', module: './dist/tools/system.js', register: 'registerSystemTools' },
      { name: 'permissions', module: './dist/tools/permissions.js', register: 'registerPermissionTools' },
      { name: 'fields', module: './dist/tools/fields.js', register: 'registerFieldTools' },
      { name: 'issue-types', module: './dist/tools/issue-types.js', register: 'registerIssueTypeTools' },
      { name: 'workflows', module: './dist/tools/workflows.js', register: 'registerWorkflowTools' },
      { name: 'screens', module: './dist/tools/screens.js', register: 'registerScreenTools' },
      { name: 'field-contexts', module: './dist/tools/field-contexts.js', register: 'registerFieldContextTools' },
      { name: 'field-configurations', module: './dist/tools/field-configurations.js', register: 'registerFieldConfigurationTools' },
      { name: 'notifications-screens', module: './dist/tools/notifications-screens.js', register: 'registerNotificationScreenTools' },
      { name: 'dashboards', module: './dist/tools/dashboards.js', register: 'registerDashboardTools' },
    ];

    for (const toolModule of toolModules) {
      try {
        const imported = await import(toolModule.module);
        // Safe property access using Object.entries() and find()
        const registerFunction = Object.entries(imported).find(([key]) => key === toolModule.register)?.[1] || null;
        if (registerFunction && typeof registerFunction === 'function') {
          await registerFunction(server, apiClient);
          console.error(`✓ ${toolModule.name} tools registered successfully`);
        } else {
          console.error(`✗ ${toolModule.name} - register function not found`);
        }
      } catch (error) {
        console.error(`✗ ${toolModule.name} tools failed:`, error.message);
      }
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