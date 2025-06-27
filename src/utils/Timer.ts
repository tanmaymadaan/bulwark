/**
 * Timer utility for managing timeouts and delays
 */
export class Timer {
  private readonly duration: number;
  private startTime?: number;
  private timeoutId?: NodeJS.Timeout;
  private promise?: Promise<void>;

  /**
   * Creates a new Timer instance
   * @param {number} duration - Timer duration in milliseconds
   */
  constructor(duration: number) {
    if (duration <= 0) {
      throw new Error("Duration must be greater than 0");
    }
    this.duration = duration;
  }

  /**
   * Starts the timer
   * @param {Function} [callback] - Optional callback to execute when timer expires
   * @returns {Promise<void>} Promise that resolves when timer expires
   */
  start(callback?: () => void): Promise<void> {
    if (this.isRunning()) {
      return this.promise!;
    }

    this.startTime = Date.now();

    this.promise = new Promise<void>((resolve) => {
      this.timeoutId = setTimeout(() => {
        this.cleanup();
        if (callback) {
          callback(); // Let exceptions bubble up
        }
        resolve();
      }, this.duration);
    });

    return this.promise;
  }

  /**
   * Stops the timer if it's running
   * @returns {boolean} True if timer was stopped, false if it wasn't running
   */
  stop(): boolean {
    if (!this.isRunning()) {
      return false;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.cleanup();
    return true;
  }

  /**
   * Gets the remaining time in milliseconds
   * @returns {number} Remaining time in milliseconds, 0 if not running or expired
   */
  getRemainingTime(): number {
    if (!this.isRunning() || typeof this.startTime !== "number") {
      return 0;
    }

    const elapsed = Date.now() - this.startTime;
    const remaining = Math.max(0, this.duration - elapsed);
    return remaining;
  }

  /**
   * Gets the elapsed time since the timer started
   * @returns {number} Elapsed time in milliseconds, 0 if not started
   */
  getElapsedTime(): number {
    if (typeof this.startTime !== "number") {
      return 0;
    }

    return Date.now() - this.startTime;
  }

  /**
   * Checks if the timer is currently running
   * @returns {boolean} True if timer is running
   */
  isRunning(): boolean {
    return this.timeoutId !== undefined;
  }

  /**
   * Resets the timer to its initial state
   * @returns {void}
   */
  reset(): void {
    this.stop();
    delete (this as unknown as { startTime?: number }).startTime;
    delete (this as unknown as { promise?: Promise<void> }).promise;
  }

  /**
   * Cleans up timer resources
   * @returns {void}
   */
  private cleanup(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      delete (this as unknown as { timeoutId?: NodeJS.Timeout }).timeoutId;
    }
  }

  /**
   * Creates a promise that rejects after the specified duration
   * @param {number} duration - Timeout duration in milliseconds
   * @param {string} message - Error message for timeout
   * @returns {Promise<never>} Promise that rejects with timeout error
   */
  static createTimeoutPromise(duration: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, duration);
    });
  }

  /**
   * Creates a promise that resolves after the specified delay
   * @param {number} duration - Delay duration in milliseconds
   * @returns {Promise<void>} Promise that resolves after the delay
   */
  static delay(duration: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, duration);
    });
  }

  /**
   * Races a promise against a timeout
   * @param {Promise<T>} promise - The promise to race
   * @param {number} timeout - Timeout duration in milliseconds
   * @param {string} message - Error message for timeout
   * @returns {Promise<T>} Promise that resolves with the original promise or rejects on timeout
   */
  static withTimeout<T>(promise: Promise<T>, timeout: number, message: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(message));
      }, timeout);
    });

    return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeoutPromise]);
  }
}
