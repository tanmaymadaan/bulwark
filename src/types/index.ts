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
 * Enhanced metrics with detailed statistics for monitoring
 */
export interface DetailedMetrics extends CircuitBreakerMetrics {
  /** Response time percentiles */
  responseTimePercentiles: ResponseTimePercentiles;
  /** Call rates over different time windows */
  callRates: CallRates;
  /** Error distribution by type */
  errorDistribution: Map<string, number>;
  /** Memory usage statistics */
  memoryUsage: MemoryUsage;
  /** Performance overhead statistics */
  performanceOverhead: PerformanceOverhead;
}

/**
 * Response time percentile statistics
 */
export interface ResponseTimePercentiles {
  /** 50th percentile (median) */
  p50: number;
  /** 75th percentile */
  p75: number;
  /** 90th percentile */
  p90: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
  /** Minimum response time */
  min: number;
  /** Maximum response time */
  max: number;
}

/**
 * Call rate statistics over different time windows
 */
export interface CallRates {
  /** Calls per second over last minute */
  perSecond: number;
  /** Calls per minute over last hour */
  perMinute: number;
  /** Calls per hour over last day */
  perHour: number;
}

/**
 * Memory usage statistics for the circuit breaker
 */
export interface MemoryUsage {
  /** Current memory usage in bytes */
  current: number;
  /** Peak memory usage in bytes */
  peak: number;
  /** Memory growth rate in bytes per second */
  growthRate: number;
}

/**
 * Performance overhead statistics
 */
export interface PerformanceOverhead {
  /** Average overhead per call in milliseconds */
  averageOverhead: number;
  /** Maximum overhead observed in milliseconds */
  maxOverhead: number;
  /** Overhead percentiles */
  overheadPercentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
}

/**
 * Metrics export format for external monitoring systems
 */
export interface MetricsExport {
  /** Circuit breaker instance name/identifier */
  instanceId: string;
  /** Export timestamp */
  timestamp: Date;
  /** Basic metrics */
  metrics: CircuitBreakerMetrics;
  /** Detailed metrics */
  detailed?: DetailedMetrics;
  /** Labels for grouping/filtering */
  labels: Record<string, string>;
}

/**
 * Metrics snapshot for time-series analysis
 */
export interface MetricsSnapshot {
  /** Snapshot timestamp */
  timestamp: Date;
  /** Circuit state at snapshot time */
  state: CircuitState;
  /** Total calls since last snapshot */
  callsSinceLastSnapshot: number;
  /** Failures since last snapshot */
  failuresSinceLastSnapshot: number;
  /** Average response time since last snapshot */
  avgResponseTimeSinceLastSnapshot: number;
  /** Memory usage at snapshot time */
  memoryUsage: number;
}

/**
 * Custom error for circuit breaker operations
 */
export class CircuitBreakerError extends Error {
  /**
   * Creates a new CircuitBreakerError
   * @param {string} message - Error message
   * @param {CircuitState} state - Current circuit state when error occurred
   */
  constructor(
    message: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = "CircuitBreakerError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, CircuitBreakerError);
    }
  }
}

/**
 * Custom error for timeout operations
 */
export class TimeoutError extends Error {
  /**
   * Creates a new TimeoutError
   * @param {string} message - Error message
   * @param {number} timeout - Timeout value that was exceeded
   */
  constructor(
    message: string,
    public readonly timeout: number
  ) {
    super(message);
    this.name = "TimeoutError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}

/**
 * Record for tracking call results in sliding window
 */
export interface CallRecord {
  /** Timestamp of the call */
  timestamp: number;
  /** Whether the call was successful */
  isSuccess: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** Error if call failed */
  error?: Error;
}

/**
 * Record for tracking failures in sliding window
 */
export interface FailureRecord {
  /** Timestamp of the call */
  timestamp: number;
  /** Error that occurred (null for success) */
  error: Error | null;
  /** Whether this should be considered a failure */
  isFailure: boolean;
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
