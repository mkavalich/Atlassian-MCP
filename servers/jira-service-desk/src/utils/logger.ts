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

const SENSITIVE_LOG_KEYS = [
  'authorization', 'apitoken', 'api_token', 'token', 'password', 'passwd',
  'secret', 'cookie', 'set-cookie', 'session', 'email', 'x-api-key',
];

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_LOG_KEYS.some((s) => k.toLowerCase().includes(s))
      ? '[REDACTED]'
      : redactSensitive(v, depth + 1);
  }
  return out;
}

export function logApiCall(method: string, path: string, statusCode?: number, duration?: number) {
  logger.info('API Call', {
    method,
    path: typeof path === 'string' ? path.split('?')[0] : path,
    statusCode,
    duration,
  });
}

export function logError(error: Error, context?: Record<string, any>) {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...(redactSensitive(context) as Record<string, any>),
  });
}