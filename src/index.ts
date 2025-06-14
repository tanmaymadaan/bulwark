/**
 * Bulwark Circuit Breaker Library
 *
 * A modern, TypeScript-first circuit breaker library for Node.js applications
 */

// Core exports
export { CircuitBreaker } from "./core/CircuitBreaker";

// Type exports
export { CircuitState, CircuitBreakerError, TimeoutError, DEFAULT_CONFIG } from "./types/index";

// Type interfaces (for TypeScript users)
export type {
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  Operation,
  CallRecord,
  FailureRecord,
} from "./types/index";

// Version export
export const VERSION = "0.0.2";

// Utility exports (for advanced users)
export { SlidingWindow } from "./metrics/SlidingWindow";
export { MetricsCollector } from "./metrics/MetricsCollector";
export { FailureDetector } from "./core/FailureDetector";
export { StateManager } from "./core/StateManager";
