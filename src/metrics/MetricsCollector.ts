import { CallRecord, CircuitState, CircuitBreakerMetrics } from "../types/index";
import { SlidingWindow } from "./SlidingWindow";

/**
 * Collects and manages circuit breaker metrics in real-time
 */
export class MetricsCollector {
  private totalCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private readonly slidingWindow: SlidingWindow<CallRecord>;
  private responseTimes: number[] = [];
  private readonly maxResponseTimes = 100; // Keep last 100 response times for average calculation

  /**
   * Creates a new metrics collector
   * @param {number} windowSize - Size of the sliding window for call tracking
   */
  constructor(windowSize: number = 100) {
    this.slidingWindow = new SlidingWindow<CallRecord>(windowSize);
  }

  /**
   * Records a successful operation
   * @param {number} responseTime - Response time in milliseconds
   * @returns {void}
   */
  public recordSuccess(responseTime: number): void {
    this.totalCalls++;
    this.successfulCalls++;
    this.recordResponseTime(responseTime);

    this.slidingWindow.add({
      timestamp: Date.now(),
      isSuccess: true,
      responseTime,
    });
  }

  /**
   * Records a failed operation
   * @param {number} responseTime - Response time in milliseconds
   * @param {Error} [error] - Error that occurred
   * @returns {void}
   */
  public recordFailure(responseTime: number, error?: Error): void {
    this.totalCalls++;
    this.failedCalls++;
    this.recordResponseTime(responseTime);

    this.slidingWindow.add({
      timestamp: Date.now(),
      isSuccess: false,
      responseTime,
      ...(error && { error }),
    });
  }

  /**
   * Gets current metrics snapshot
   * @param {CircuitState} currentState - Current circuit state
   * @param {Date} lastStateChange - Last state change timestamp
   * @param {Date} [nextAttempt] - Next attempt timestamp (for OPEN state)
   * @returns {CircuitBreakerMetrics} Current metrics
   */
  public getMetrics(
    currentState: CircuitState,
    lastStateChange: Date,
    nextAttempt?: Date
  ): CircuitBreakerMetrics {
    return {
      state: currentState,
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      failureRate: this.calculateFailureRate(),
      averageResponseTime: this.calculateAverageResponseTime(),
      lastStateChange,
      ...(nextAttempt && { nextAttempt }),
    };
  }

  /**
   * Export metrics as JSON string for external systems
   * @param {CircuitState} currentState - Current circuit state
   * @param {Date} lastStateChange - Last state change timestamp
   * @param {Date} [nextAttempt] - Next attempt timestamp (for OPEN state)
   * @returns {string} JSON formatted metrics
   */
  public exportJSON(currentState: CircuitState, lastStateChange: Date, nextAttempt?: Date): string {
    const metrics = this.getMetrics(currentState, lastStateChange, nextAttempt);
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        circuitBreaker: metrics,
      },
      null,
      2
    );
  }

  /**
   * Get sliding window statistics
   * @returns {object} Window statistics including size, count, and failure rate
   */
  public getWindowStats(): {
    windowSize: number;
    currentCount: number;
    failureRate: number;
  } {
    return {
      windowSize: this.slidingWindow.getMaxSize(),
      currentCount: this.slidingWindow.size(),
      failureRate: this.getFailureRate(),
    };
  }

  /**
   * Gets failure rate from sliding window
   * @returns {number} Failure rate (0-1)
   */
  public getFailureRate(): number {
    const records: readonly CallRecord[] = this.slidingWindow.getAll();
    if (records.length === 0) return 0;

    const failures = records.filter((record: CallRecord) => record.isSuccess === false).length;
    return failures / records.length;
  }

  /**
   * Gets total calls from sliding window
   * @returns {number} Number of calls in sliding window
   */
  public getWindowCallCount(): number {
    return this.slidingWindow.size();
  }

  /**
   * Resets all metrics to initial state
   * @returns {void}
   */
  public reset(): void {
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.responseTimes = [];
    this.slidingWindow.clear();
  }

  /**
   * Records response time for average calculation
   * @param {number} responseTime - Response time in milliseconds
   * @returns {void}
   */
  private recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);

    // Keep only the most recent response times to prevent memory growth
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }
  }

  /**
   * Calculates current failure rate
   * @returns {number} Failure rate (0-1)
   */
  private calculateFailureRate(): number {
    if (this.totalCalls === 0) return 0;
    return this.failedCalls / this.totalCalls;
  }

  /**
   * Calculates average response time
   * @returns {number} Average response time in milliseconds
   */
  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;

    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.responseTimes.length;
  }
}
