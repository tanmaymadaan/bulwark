/**
 * Bulwark Circuit Breaker Library
 *
 * A modern, TypeScript-first circuit breaker library for Node.js applications
 */

// Core exports
export { CircuitBreaker } from "./core/CircuitBreaker";

// Type exports
export {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerError,
  Operation,
  DEFAULT_CONFIG,
} from "./types/index";

// Version export
export const VERSION = "0.0.1";
