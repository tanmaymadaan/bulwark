/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Percentage of failures before opening circuit (0-1) */
  failureRateThreshold: number;
  /** Timeout for operations in milliseconds */
  timeout: number;
  /** Time to wait before attempting to close circuit in milliseconds */
  resetTimeout: number;
  /** Minimum number of calls before calculating failure rate */
  minimumThroughput: number;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  /** Current circuit state */
  state: CircuitState;
  /** Total number of calls */
  totalCalls: number;
  /** Number of successful calls */
  successfulCalls: number;
  /** Number of failed calls */
  failedCalls: number;
  /** Current failure rate (0-1) */
  failureRate: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** Last state change timestamp */
  lastStateChange: Date;
  /** Next attempt timestamp (for OPEN state) */
  nextAttempt?: Date;
}

/**
 * Custom error for circuit breaker operations
 */
export class CircuitBreakerError extends Error {
  /**
   * Creates a new CircuitBreakerError
   * @param message - Error message
   * @param state - Current circuit state when error occurred
   */
  constructor(
    message: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = "CircuitBreakerError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CircuitBreakerError);
    }
  }
}

/**
 * Operation function type for circuit breaker execution
 */
export type Operation<T> = () => Promise<T>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureRateThreshold: 0.5,
  timeout: 3000,
  resetTimeout: 60000,
  minimumThroughput: 10,
};
