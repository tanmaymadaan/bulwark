import { CircuitBreaker } from "../../src/core/CircuitBreaker";
import { CircuitState } from "../../src/types";
import { Timer } from "../../src/utils/Timer";
import { ErrorClassifier, ErrorType } from "../../src/utils/Errors";

describe("End-to-End Integration Tests", () => {
  describe("Real-world HTTP API simulation", () => {
    let circuitBreaker: CircuitBreaker;
    let apiCallCount = 0;
    let shouldFail = false;

    const apiCall = async (): Promise<{ data: string }> => {
      apiCallCount++;
      if (shouldFail) {
        throw new Error("API call failed");
      }
      return { data: "success" };
    };

    beforeEach(() => {
      apiCallCount = 0;
      shouldFail = false;
      circuitBreaker = new CircuitBreaker({
        failureRateThreshold: 0.7,
        minimumThroughput: 4,
        resetTimeout: 200,
        timeout: 200,
      });
    });

    it("should handle complete failure and recovery cycle", async () => {
      // Phase 1: Normal operation
      const result1 = await circuitBreaker.execute(() => apiCall());
      expect(result1.data).toBe("success");
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Phase 2: Trigger failures (need 4 calls with 3+ failures to open circuit)
      shouldFail = true;
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => apiCall());
          fail("Should have thrown error");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Phase 3: Circuit is open - calls should be rejected immediately
      try {
        await circuitBreaker.execute(() => apiCall());
        fail("Should have thrown CircuitBreakerError");
      } catch (error: any) {
        expect(error.message).toContain("Circuit breaker is OPEN");
      }
      expect(apiCallCount).toBe(4); // Circuit open call doesn't increment count

      // Phase 4: Wait for reset timeout and test half-open state
      await new Promise((resolve) => setTimeout(resolve, 250)); // Wait longer than reset timeout (200ms)

      // Successful call should close the circuit
      shouldFail = false;
      const recoveryResult = await circuitBreaker.execute(() => apiCall());
      expect(recoveryResult.data).toBe("success");
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Phase 5: Normal operation should resume
      const finalResult = await circuitBreaker.execute(() => apiCall());
      expect(finalResult.data).toBe("success");
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle timeout scenarios", async () => {
      const slowApiCall = () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("slow response"), 300); // Exceeds 200ms timeout
        });

      // Need multiple timeouts to trigger circuit breaker (minimum 4 calls)
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(() => slowApiCall());
          fail("Should have timed out");
        } catch (error: any) {
          expect(error.message).toContain("Operation timed out after");
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it("should handle mixed success and failure patterns", async () => {
      const results: any[] = [];
      const errors: any[] = [];

      // Mix of successes and failures
      for (let i = 0; i < 10; i++) {
        shouldFail = i % 3 === 0; // Fail every 3rd call
        try {
          const result = await circuitBreaker.execute(() => apiCall());
          results.push(result);
        } catch (error) {
          errors.push(error);
        }
      }

      expect(results.length).toBeGreaterThan(0);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should handle high concurrency correctly", async () => {
      const concurrentOperation = async (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error("Concurrent failure");
        }
        return { data: "concurrent success" };
      };

      // Execute concurrent operations with mixed results
      const promises = [];

      // Add some successful operations first
      for (let i = 0; i < 3; i++) {
        promises.push(
          circuitBreaker.execute(() => concurrentOperation(false)).catch(() => "failed")
        );
      }

      // Add many failing operations to trigger circuit breaker
      for (let i = 0; i < 12; i++) {
        promises.push(
          circuitBreaker.execute(() => concurrentOperation(true)).catch(() => "failed")
        );
      }

      await Promise.all(promises);

      // With 80% failure rate threshold and 15 total calls (3 success, 12 failures)
      // Failure rate = 12/15 = 0.8, which should trigger the circuit breaker
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe("Database connection simulation", () => {
    let circuitBreaker: CircuitBreaker;
    let connectionPool: number;

    const databaseQuery = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        if (connectionPool <= 0) {
          reject(new Error("Connection pool exhausted"));
        } else {
          connectionPool--;
          setTimeout(() => {
            connectionPool++; // Return connection to pool
            resolve("query success");
          }, 50);
        }
      });
    };

    beforeEach(() => {
      connectionPool = 5; // Simulate connection pool with 5 connections
      circuitBreaker = new CircuitBreaker({
        failureRateThreshold: 0.7,
        minimumThroughput: 4,
        resetTimeout: 200,
        timeout: 1000,
      });
    });

    it("should handle database connection exhaustion", async () => {
      // Establish baseline with successful call
      const baselineResult = await circuitBreaker.execute(() => databaseQuery());
      expect(baselineResult).toBe("query success");
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Exhaust connection pool
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          circuitBreaker.execute(() => databaseQuery()).catch((error: any) => ({ error }))
        );
      }

      const results = await Promise.all(promises);
      const failures = results.filter((r: any) => r.error);

      expect(failures.length).toBeGreaterThan(3); // Should have enough failures
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout (200ms)
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Restore connections and test recovery
      connectionPool = 5;
      const result2 = await circuitBreaker.execute(() => databaseQuery());
      expect(result2).toBe("query success");
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("Error classification integration", () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        failureRateThreshold: 0.8, // 80% failure rate threshold
        resetTimeout: 100,
        timeout: 50,
        minimumThroughput: 3, // Need at least 3 calls
      });
    });

    it("should handle different error types appropriately", async () => {
      // Network error - should trigger circuit breaker
      const networkError = new Error("ECONNREFUSED");
      networkError.name = "NetworkError";

      await expect(circuitBreaker.execute(() => Promise.reject(networkError))).rejects.toThrow();

      // Validation error - should not trigger circuit breaker as aggressively
      const validationError = new Error("Invalid input data");
      validationError.name = "ValidationError";

      await expect(circuitBreaker.execute(() => Promise.reject(validationError))).rejects.toThrow();

      // Another network error - should open circuit
      await expect(circuitBreaker.execute(() => Promise.reject(networkError))).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Classify the errors
      const networkClassification = ErrorClassifier.classify(networkError);
      expect(networkClassification.type).toBe(ErrorType.NETWORK);
      expect(networkClassification.shouldTriggerCircuitBreaker).toBe(true);
      expect(networkClassification.isRetryable).toBe(true);

      const validationClassification = ErrorClassifier.classify(validationError);
      expect(validationClassification.type).toBe(ErrorType.VALIDATION);
      expect(validationClassification.shouldTriggerCircuitBreaker).toBe(false);
      expect(validationClassification.isRetryable).toBe(false);
    });

    it("should handle HTTP status code errors", async () => {
      const serviceUnavailableError = new Error("Service Unavailable");
      (serviceUnavailableError as any).status = 503;

      // Create rate limit error with high retry-after to trigger circuit breaker
      const rateLimitError = new Error("Too Many Requests");
      (rateLimitError as any).status = 429;
      (rateLimitError as any).retryAfter = "120"; // High retry-after triggers circuit breaker

      let callCount = 0;
      const faultyService = async () => {
        callCount++;
        if (callCount <= 2) {
          throw serviceUnavailableError;
        } else if (callCount <= 4) {
          throw rateLimitError;
        }
        return { data: "success" };
      };

      // Verify error classifications
      const serviceClassification = ErrorClassifier.classify(serviceUnavailableError);
      const rateLimitClassification = ErrorClassifier.classify(rateLimitError);

      expect(serviceClassification.shouldTriggerCircuitBreaker).toBe(true);
      expect(rateLimitClassification.shouldTriggerCircuitBreaker).toBe(true);

      // Need 4 calls with 3+ failures to trigger circuit breaker
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(faultyService);
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it("should handle high concurrency correctly", async () => {
      const concurrentOperation = async (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error("Concurrent failure");
        }
        return { data: "concurrent success" };
      };

      // Execute concurrent operations with mixed results
      const promises = [];

      // Add some successful operations first
      for (let i = 0; i < 3; i++) {
        promises.push(
          circuitBreaker.execute(() => concurrentOperation(false)).catch(() => "failed")
        );
      }

      // Add many failing operations to trigger circuit breaker
      for (let i = 0; i < 12; i++) {
        promises.push(
          circuitBreaker.execute(() => concurrentOperation(true)).catch(() => "failed")
        );
      }

      await Promise.all(promises);

      // With 80% failure rate threshold and 15 total calls (3 success, 12 failures)
      // Failure rate = 12/15 = 0.8, which should trigger the circuit breaker
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe("Metrics and monitoring integration", () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        failureRateThreshold: 0.7, // 70% failure rate threshold
        resetTimeout: 100,
        timeout: 50,
        minimumThroughput: 4, // Need at least 4 calls
      });
    });

    it("should provide comprehensive metrics", async () => {
      let operationCount = 0;

      const monitoredOperation = async () => {
        operationCount++;
        if (operationCount <= 4) {
          // First 4 calls fail
          throw new Error("Monitored failure");
        }
        // 5th and 6th calls succeed
        return { data: "success", count: operationCount };
      };

      // Execute operations to generate metrics (circuit will open after 4 failures)
      for (let i = 0; i < 6; i++) {
        try {
          await circuitBreaker.execute(() => monitoredOperation());
        } catch (error) {
          // Expected failures and circuit breaker errors
        }
      }

      const metrics = circuitBreaker.getMetrics();

      expect(metrics.totalCalls).toBe(4); // Circuit opens after 4 calls
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(4);
      expect(metrics.failureRate).toBe(1.0); // 100% failure rate
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);

      // Verify sliding window access through metrics collector
      expect(metrics.state).toBeDefined();
    });

    it("should track performance metrics accurately", async () => {
      const fastOperation = async () => {
        await Timer.delay(10);
        return "fast";
      };

      const slowOperation = async () => {
        await Timer.delay(30);
        return "slow";
      };

      // Execute operations with different response times
      await circuitBreaker.execute(fastOperation);
      await circuitBreaker.execute(slowOperation);
      await circuitBreaker.execute(fastOperation);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.averageResponseTime).toBeGreaterThan(10);
      expect(metrics.averageResponseTime).toBeLessThan(50);

      // Verify sliding window has records
      const slidingWindow = (circuitBreaker as any).slidingWindow;
      if (slidingWindow && slidingWindow.getRecords) {
        const records = slidingWindow.getRecords();
        expect(records.length).toBe(3);
        expect(records.every((record: any) => record.responseTime > 0)).toBe(true);
      }
    });
  });

  describe("Concurrent operations integration", () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        failureRateThreshold: 0.8, // 80% failure rate threshold
        resetTimeout: 200,
        timeout: 100,
        minimumThroughput: 10, // Need more calls for concurrency test
      });
    });

    it("should handle state transitions under concurrent load", async () => {
      let shouldFail = false;

      const operation = async () => {
        if (shouldFail) {
          throw new Error("Service down");
        }
        await Timer.delay(10);
        return "success";
      };

      // Start with successful operations
      const initialPromises = Array.from({ length: 10 }, () => circuitBreaker.execute(operation));

      await Promise.all(initialPromises);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Switch to failing operations
      shouldFail = true;

      const failingPromises = Array.from({ length: 10 }, () =>
        circuitBreaker.execute(operation).catch((err) => err.message)
      );

      await Promise.all(failingPromises);
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Verify circuit breaker behavior under load
      const rejectedPromises = Array.from({ length: 5 }, () =>
        circuitBreaker.execute(operation).catch((err) => err.message)
      );

      const rejectedResults = await Promise.all(rejectedPromises);
      expect(rejectedResults.every((result) => result.includes("Circuit breaker is OPEN"))).toBe(
        true
      );
    });
  });

  describe("Timer utility integration", () => {
    it("should integrate Timer utility with circuit breaker operations", async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100,
        timeout: 50,
      });

      const timedOperation = async () => {
        const timer = new Timer(30);
        await timer.start();
        return "completed";
      };

      // Should succeed within timeout
      const result = await circuitBreaker.execute(timedOperation);
      expect(result).toBe("completed");

      const longOperation = async () => {
        await Timer.delay(100); // Longer than circuit breaker timeout
        return "too slow";
      };

      // Should timeout
      await expect(circuitBreaker.execute(longOperation)).rejects.toThrow("Operation timed out");
    });

    it("should handle Timer.withTimeout integration", async () => {
      const operation = async () => {
        await Timer.delay(200);
        return "slow result";
      };

      // Use Timer.withTimeout directly
      await expect(Timer.withTimeout(operation(), 100, "Custom timeout")).rejects.toThrow(
        "Custom timeout"
      );

      // Use with circuit breaker
      const circuitBreaker = new CircuitBreaker({ timeout: 150 });
      await expect(circuitBreaker.execute(operation)).rejects.toThrow("Operation timed out");
    });
  });
});
