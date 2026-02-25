// Primary API - what server entrypoints use
export { createOptimizationHooks, type OptimizationHooksConfig, type SupportedServer } from './hooks/index.js';
export { startServer, createOptimizedServer, type OptimizedServerConfig } from './server/create-optimized-server.js';

// Hooks composer
export { composeHooks, type ComposableHooks } from './server/hooks-composer.js';
