import { FailureRecord, CircuitBreakerConfig } from "../types/index";
import { SlidingWindow } from "../metrics/SlidingWindow";

/**
 * Detects failures and determines when circuit should open
 */
export class FailureDetector {
  private readonly slidingWindow: SlidingWindow<FailureRecord>;
  private readonly config: CircuitBreakerConfig;
  private consecutiveFailures = 0;

  /**
   * Creates a new failure detector
   * @param {CircuitBreakerConfig} config - Circuit breaker configuration
   */
  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    // Use double the minimum throughput for better rate calculation accuracy
    this.slidingWindow = new SlidingWindow<FailureRecord>(config.minimumThroughput * 2);
  }

  /**
   * Records a successful operation
   * @param {Error} [error] - Error that occurred (optional)
   * @returns {void}
   */
  public recordSuccess(error?: Error): void {
    this.consecutiveFailures = 0;

    this.slidingWindow.add({
      timestamp: Date.now(),
      isFailure: false,
      error: error || null,
    });
  }

  /**
   * Records a failed operation
   * @param {Error} error - Error that occurred
   * @returns {void}
   */
  public recordFailure(error: Error): void {
    this.consecutiveFailures++;

    this.slidingWindow.add({
      timestamp: Date.now(),
      isFailure: true,
      error,
    });
  }

  /**
   * Gets the current consecutive failure count
   * @returns {number} Number of consecutive failures
   */
  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Gets the failure rate from the sliding window
   * @returns {number} Failure rate (0-1)
   */
  public getFailureRate(): number {
    const records = this.slidingWindow.getAll();
    if (records.length === 0) return 0;

    const failures = records.filter((record) => record.isFailure).length;
    return failures / records.length;
  }

  /**
   * Gets the total number of calls in the sliding window
   * @returns {number} Number of calls
   */
  public getCallCount(): number {
    return this.slidingWindow.size();
  }

  /**
   * Determines if the circuit should be opened based on current failure patterns
   * @returns {boolean} True if circuit should be opened
   */
  public shouldOpenCircuit(): boolean {
    const recentRecords = this.slidingWindow.getAll();

    // Check if we have enough data points
    if (recentRecords.length < this.config.minimumThroughput) {
      return false;
    }

    // Count failures in the recent window
    const failures = recentRecords.filter((record) => record.isFailure).length;
    const failureRate = failures / recentRecords.length;

    // Check both absolute failure count and failure rate thresholds
    return (
      failures >= this.config.failureThreshold || failureRate >= this.config.failureRateThreshold
    );
  }

  /**
   * Resets the failure detector to initial state
   * @returns {void}
   */
  public reset(): void {
    this.consecutiveFailures = 0;
    this.slidingWindow.clear();
  }
}
