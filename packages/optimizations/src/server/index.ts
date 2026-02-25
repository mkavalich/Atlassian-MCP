/**
 * Server Module
 */

// Hooks Composer
export {
  composeHooks,
  createWrapperHooks,
  type ComposableHooks,
} from './hooks-composer.js';

// Optimized Server Factory
export {
  createOptimizedServer,
  startServer,
  type OptimizedServerConfig,
} from './create-optimized-server.js';
