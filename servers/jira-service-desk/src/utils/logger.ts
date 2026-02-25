import * as winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'jira-service-desk-mcp-server' },
  transports: [
    // Use Console transport configured to write all levels to stderr
    // This keeps stdout clean for MCP JSON protocol communication
    new winston.transports.Console({
      stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});

export function logApiCall(method: string, path: string, statusCode?: number, duration?: number) {
  logger.info('API Call', {
    method,
    path,
    statusCode,
    duration,
  });
}

export function logError(error: Error, context?: Record<string, any>) {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
}