#!/usr/bin/env node

import dotenv from 'dotenv';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';
import { startServer } from '@atlassian-mcp/optimizations';

dotenv.config();

async function main() {
  await startServer({
    name: 'jira-system-admin',
    createBaseServer: createServer,
    enableCaching: true,
    enableSchemaRegistry: true,
    debug: process.env.DEBUG === 'true',
  });
}

main().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
