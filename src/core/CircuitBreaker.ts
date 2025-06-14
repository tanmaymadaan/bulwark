import {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  Operation,
  DEFAULT_CONFIG,
  CircuitBreakerError,
  TimeoutError,
} from "../types/index";
import { StateManager } from "./StateManager";
import { FailureDetector } from "./FailureDetector";
import { MetricsCollector } from "../metrics/MetricsCollector";

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
  private readonly stateManager: StateManager;
  private readonly failureDetector: FailureDetector;
  private readonly metricsCollector: MetricsCollector;
  private lastFailureTime: Date | undefined;

  /**
   * Creates a new circuit breaker instance
   * @param {Partial<CircuitBreakerConfig>} config - Configuration options (partial, will be merged with defaults)
   */
  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Validate configuration before creating components
    this.validateConfig();

    this.stateManager = new StateManager();
    this.failureDetector = new FailureDetector(this.config);
    this.metricsCollector = new MetricsCollector(this.config.minimumThroughput * 2);
    this.lastFailureTime = undefined;
  }

  /**
   * Executes an operation with circuit breaker protection
   * @param {Operation<R>} operation - Async operation to execute
   * @returns {Promise<R>} Promise resolving to operation result
   * @throws {CircuitBreakerError} When circuit is open and not ready for retry
   * @throws {TimeoutError} When operation exceeds timeout
   * @throws {Error} When operation fails
   */
  public async execute<R>(operation: Operation<R>): Promise<R> {
    // Check current state and decide whether to execute
    const currentState = this.stateManager.getState();

    if (currentState === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.stateManager.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN. Next attempt allowed at ${this.getNextAttemptTime()?.toISOString()}`,
          currentState
        );
      }
    }

    // Execute with timeout and failure detection
    const startTime = Date.now();
    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(error as Error, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Gets the current circuit state
   * @returns Current circuit state
   */
  public getState(): CircuitState {
    return this.stateManager.getState();
  }

  /**
   * Gets current circuit breaker metrics
   * @returns Current metrics snapshot
   */
  public getMetrics(): CircuitBreakerMetrics {
    return this.metricsCollector.getMetrics(
      this.stateManager.getState(),
      this.stateManager.getLastStateChange(),
      this.getNextAttemptTime()
    );
  }

  /**
   * Resets the circuit breaker to initial state
   * @returns {void}
   */
  public reset(): void {
    this.stateManager.reset();
    this.failureDetector.reset();
    this.metricsCollector.reset();
    this.lastFailureTime = undefined;
  }

  /**
   * Gets the configuration used by this circuit breaker
   * @returns {Readonly<CircuitBreakerConfig>} Current configuration
   */
  public getConfig(): Readonly<CircuitBreakerConfig> {
    return { ...this.config };
  }

  /**
   * Executes operation with timeout protection
   * @param {Operation<R>} operation - Operation to execute
   * @returns {Promise<R>} Promise resolving to operation result
   * @throws TimeoutError if operation exceeds timeout
   */
  private async executeWithTimeout<R>(operation: Operation<R>): Promise<R> {
    return Promise.race([operation(), this.createTimeoutPromise<R>()]);
  }

  /**
   * Creates a promise that rejects after the configured timeout
   * @returns Promise that rejects with TimeoutError
   */
  private createTimeoutPromise<R>(): Promise<R> {
    return new Promise<R>((_, reject) => {
      setTimeout(() => {
        reject(
          new TimeoutError(
            `Operation timed out after ${this.config.timeout}ms`,
            this.config.timeout
          )
        );
      }, this.config.timeout);
    });
  }

  /**
   * Handles successful operation execution
   * @param {number} responseTime - Response time in milliseconds
   * @returns {void}
   */
  private onSuccess(responseTime: number): void {
    this.metricsCollector.recordSuccess(responseTime);
    this.failureDetector.recordSuccess();

    // If we're in HALF_OPEN state and got a success, close the circuit
    if (this.stateManager.getState() === CircuitState.HALF_OPEN) {
      this.stateManager.transitionTo(CircuitState.CLOSED);
    }
  }

  /**
   * Handles failed operation execution
   * @param {Error} error - Error that occurred
   * @param {number} responseTime - Response time in milliseconds
   * @returns {void}
   */
  private onFailure(error: Error, responseTime: number): void {
    this.metricsCollector.recordFailure(responseTime, error);
    this.failureDetector.recordFailure(error);
    this.lastFailureTime = new Date();

    // Check if we should open the circuit
    if (this.failureDetector.shouldOpenCircuit()) {
      this.stateManager.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Determines if we should attempt to reset from OPEN to HALF_OPEN
   * @returns True if reset should be attempted
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true; // No previous failure, allow reset
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.resetTimeout;
  }

  /**
   * Gets the next attempt time for OPEN state
   * @returns {Date | undefined} Next attempt time or undefined if not in OPEN state
   */
  private getNextAttemptTime(): Date | undefined {
    if (this.stateManager.getState() !== CircuitState.OPEN || !this.lastFailureTime) {
      return undefined;
    }

    return new Date(this.lastFailureTime.getTime() + this.config.resetTimeout);
  }

  /**
   * Validates the circuit breaker configuration
   * @returns {void}
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
}
