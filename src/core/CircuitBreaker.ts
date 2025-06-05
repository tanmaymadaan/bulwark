import {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  Operation,
  DEFAULT_CONFIG,
} from "../types/index";

/**
 * Circuit breaker for protecting against cascading failures
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   timeout: 3000
 * });
 *
 * const result = await breaker.execute(async () => {
 *   return await fetch('/api/data');
 * });
 * ```
 */
export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private state: CircuitState;
  private failureCount: number;
  private successCount: number;
  private lastFailureTime: Date | undefined;
  private lastStateChange: Date;

  /**
   * Creates a new circuit breaker instance
   * @param config - Configuration options (partial, will be merged with defaults)
   */
  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.lastStateChange = new Date();

    // Validate configuration
    this.validateConfig();
  }

  /**
   * Executes an operation with circuit breaker protection
   * @param _operation - Async operation to execute
   * @returns Promise resolving to operation result
   * @throws {Error} When operation fails or times out
   */
  public async execute<R>(_operation: Operation<R>): Promise<R> {
    // Implementation will be added in v0.0.2
    throw new Error("Not implemented - will be added in v0.0.2");
  }

  /**
   * Gets the current circuit state
   * @returns Current circuit state
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Gets current circuit breaker metrics
   * @returns Current metrics snapshot
   */
  public getMetrics(): CircuitBreakerMetrics {
    const totalCalls = this.successCount + this.failureCount;
    const failureRate = totalCalls > 0 ? this.failureCount / totalCalls : 0;
    const nextAttempt = this.getNextAttemptTime();

    return {
      state: this.state,
      totalCalls,
      successfulCalls: this.successCount,
      failedCalls: this.failureCount,
      failureRate,
      averageResponseTime: 0, // Will be implemented in v0.0.3 with metrics collection
      lastStateChange: this.lastStateChange,
      ...(nextAttempt && { nextAttempt }),
    };
  }

  /**
   * Resets the circuit breaker to initial state
   */
  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.lastStateChange = new Date();
  }

  /**
   * Gets the configuration used by this circuit breaker
   * @returns Current configuration
   */
  public getConfig(): Readonly<CircuitBreakerConfig> {
    return { ...this.config };
  }

  /**
   * Validates the circuit breaker configuration
   * @throws {Error} If configuration is invalid
   */
  private validateConfig(): void {
    const { failureThreshold, failureRateThreshold, timeout, resetTimeout, minimumThroughput } =
      this.config;

    if (failureThreshold <= 0) {
      throw new Error("failureThreshold must be greater than 0");
    }

    if (failureRateThreshold < 0 || failureRateThreshold > 1) {
      throw new Error("failureRateThreshold must be between 0 and 1");
    }

    if (timeout <= 0) {
      throw new Error("timeout must be greater than 0");
    }

    if (resetTimeout <= 0) {
      throw new Error("resetTimeout must be greater than 0");
    }

    if (minimumThroughput <= 0) {
      throw new Error("minimumThroughput must be greater than 0");
    }
  }

  /**
   * Gets the next attempt time for OPEN state
   * @returns Next attempt time or undefined if not in OPEN state
   */
  private getNextAttemptTime(): Date | undefined {
    if (this.state !== CircuitState.OPEN || !this.lastFailureTime) {
      return undefined;
    }

    return new Date(this.lastFailureTime.getTime() + this.config.resetTimeout);
  }
}
