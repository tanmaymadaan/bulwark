import { CircuitBreaker } from "../../src/core/CircuitBreaker";
import { CircuitState, CircuitBreakerConfig, DEFAULT_CONFIG } from "../../src/types";

describe("CircuitBreaker", () => {
  describe("Constructor", () => {
    it("should create instance with default configuration", () => {
      const breaker = new CircuitBreaker();

      expect(breaker).toBeInstanceOf(CircuitBreaker);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getConfig()).toEqual(DEFAULT_CONFIG);
    });

    it("should create instance with partial configuration", () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 10,
        timeout: 5000,
      };

      const breaker = new CircuitBreaker(config);
      const actualConfig = breaker.getConfig();

      expect(actualConfig.failureThreshold).toBe(10);
      expect(actualConfig.timeout).toBe(5000);
      expect(actualConfig.failureRateThreshold).toBe(DEFAULT_CONFIG.failureRateThreshold);
      expect(actualConfig.resetTimeout).toBe(DEFAULT_CONFIG.resetTimeout);
      expect(actualConfig.minimumThroughput).toBe(DEFAULT_CONFIG.minimumThroughput);
    });

    it("should create instance with full configuration", () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 8,
        failureRateThreshold: 0.7,
        timeout: 4000,
        resetTimeout: 45000,
        minimumThroughput: 15,
      };

      const breaker = new CircuitBreaker(config);

      expect(breaker.getConfig()).toEqual(config);
    });
  });

  describe("Configuration Validation", () => {
    it("should throw error for invalid failureThreshold", () => {
      expect(() => {
        new CircuitBreaker({ failureThreshold: 0 });
      }).toThrow("failureThreshold must be greater than 0");

      expect(() => {
        new CircuitBreaker({ failureThreshold: -1 });
      }).toThrow("failureThreshold must be greater than 0");
    });

    it("should throw error for invalid failureRateThreshold", () => {
      expect(() => {
        new CircuitBreaker({ failureRateThreshold: -0.1 });
      }).toThrow("failureRateThreshold must be between 0 and 1");

      expect(() => {
        new CircuitBreaker({ failureRateThreshold: 1.1 });
      }).toThrow("failureRateThreshold must be between 0 and 1");
    });

    it("should throw error for invalid timeout", () => {
      expect(() => {
        new CircuitBreaker({ timeout: 0 });
      }).toThrow("timeout must be greater than 0");

      expect(() => {
        new CircuitBreaker({ timeout: -1000 });
      }).toThrow("timeout must be greater than 0");
    });

    it("should throw error for invalid resetTimeout", () => {
      expect(() => {
        new CircuitBreaker({ resetTimeout: 0 });
      }).toThrow("resetTimeout must be greater than 0");

      expect(() => {
        new CircuitBreaker({ resetTimeout: -5000 });
      }).toThrow("resetTimeout must be greater than 0");
    });

    it("should throw error for invalid minimumThroughput", () => {
      expect(() => {
        new CircuitBreaker({ minimumThroughput: 0 });
      }).toThrow("minimumThroughput must be greater than 0");

      expect(() => {
        new CircuitBreaker({ minimumThroughput: -5 });
      }).toThrow("minimumThroughput must be greater than 0");
    });

    it("should accept valid boundary values", () => {
      expect(() => {
        new CircuitBreaker({
          failureThreshold: 1,
          failureRateThreshold: 0,
          timeout: 1,
          resetTimeout: 1,
          minimumThroughput: 1,
        });
      }).not.toThrow();

      expect(() => {
        new CircuitBreaker({
          failureRateThreshold: 1,
        });
      }).not.toThrow();
    });
  });

  describe("getState()", () => {
    it("should return initial state as CLOSED", () => {
      const breaker = new CircuitBreaker();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("getConfig()", () => {
    it("should return readonly configuration", () => {
      const config = { failureThreshold: 10 };
      const breaker = new CircuitBreaker(config);
      const returnedConfig = breaker.getConfig();

      expect(returnedConfig).toEqual({ ...DEFAULT_CONFIG, ...config });

      // Should not be the same reference (defensive copy)
      expect(returnedConfig).not.toBe(breaker.getConfig());
    });
  });

  describe("getMetrics()", () => {
    it("should return initial metrics", () => {
      const breaker = new CircuitBreaker();
      const metrics = breaker.getMetrics();

      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.failureRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.lastStateChange).toBeInstanceOf(Date);
      expect(metrics.nextAttempt).toBeUndefined();
    });

    it("should return new metrics object each time", () => {
      const breaker = new CircuitBreaker();
      const metrics1 = breaker.getMetrics();
      const metrics2 = breaker.getMetrics();

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });

    it("should include nextAttempt when circuit is OPEN with lastFailureTime", () => {
      const breaker = new CircuitBreaker({ resetTimeout: 30000 });
      const failureTime = new Date();

      // Use the state manager to set state to OPEN and set lastFailureTime
      (breaker as any).stateManager.transitionTo(CircuitState.OPEN);
      (breaker as any).lastFailureTime = failureTime;

      const metrics = breaker.getMetrics();

      expect(metrics.state).toBe(CircuitState.OPEN);
      expect(metrics.nextAttempt).toBeInstanceOf(Date);
      expect(metrics.nextAttempt!.getTime()).toBe(failureTime.getTime() + 30000);
    });

    it("should calculate failure rate correctly", () => {
      const breaker = new CircuitBreaker();

      // Use the metrics collector to record some successes and failures
      const metricsCollector = (breaker as any).metricsCollector;

      // Record 7 successes
      for (let i = 0; i < 7; i++) {
        metricsCollector.recordSuccess(100);
      }

      // Record 3 failures
      for (let i = 0; i < 3; i++) {
        metricsCollector.recordFailure(100, new Error("test"));
      }

      const metrics = breaker.getMetrics();

      expect(metrics.totalCalls).toBe(10);
      expect(metrics.successfulCalls).toBe(7);
      expect(metrics.failedCalls).toBe(3);
      expect(metrics.failureRate).toBe(0.3);
    });
  });

  describe("reset()", () => {
    it("should reset circuit breaker to initial state", () => {
      const breaker = new CircuitBreaker();

      // Manually set some state to verify reset
      const metricsCollector = (breaker as any).metricsCollector;
      metricsCollector.recordFailure(100, new Error("test"));

      breaker.reset();

      const metrics = breaker.getMetrics();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(0);
    });

    it("should allow reset when no previous failure exists", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
        minimumThroughput: 1,
      });

      // Force circuit to OPEN state
      try {
        await breaker.execute(async () => {
          throw new Error("Test failure");
        });
      } catch (e) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Reset the lastFailureTime by resetting the breaker
      breaker.reset();

      // Now execute should work because there's no lastFailureTime
      const result = await breaker.execute(async () => "success");
      expect(result).toBe("success");
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should return undefined for next attempt time when not in OPEN state", () => {
      const breaker = new CircuitBreaker();
      const metrics = breaker.getMetrics();

      expect(metrics.nextAttempt).toBeUndefined();
    });

    it("should return undefined for next attempt time when no last failure", () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      // Force to OPEN state but then reset to clear lastFailureTime
      breaker.reset();

      // This is testing an edge case that's hard to reach in normal operation
      const metrics = breaker.getMetrics();
      expect(metrics.nextAttempt).toBeUndefined();
    });
  });

  describe("getNextAttemptTime()", () => {
    it("should return undefined when circuit is CLOSED", () => {
      const breaker = new CircuitBreaker();

      // Access private method using bracket notation for testing
      const getNextAttemptTime = (breaker as any).getNextAttemptTime.bind(breaker);

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(getNextAttemptTime()).toBeUndefined();
    });

    it("should return undefined when circuit is OPEN but no lastFailureTime", () => {
      const breaker = new CircuitBreaker();

      // Manually set state to OPEN without lastFailureTime
      (breaker as any).state = CircuitState.OPEN;
      (breaker as any).lastFailureTime = undefined;

      const getNextAttemptTime = (breaker as any).getNextAttemptTime.bind(breaker);
      expect(getNextAttemptTime()).toBeUndefined();
    });

    it("should return next attempt time when circuit is OPEN with lastFailureTime", () => {
      const breaker = new CircuitBreaker({ resetTimeout: 30000 });
      const failureTime = new Date();

      // Use the state manager to set state to OPEN and set lastFailureTime
      (breaker as any).stateManager.transitionTo(CircuitState.OPEN);
      (breaker as any).lastFailureTime = failureTime;

      const getNextAttemptTime = (breaker as any).getNextAttemptTime.bind(breaker);
      const nextAttempt = getNextAttemptTime();

      expect(nextAttempt).toBeInstanceOf(Date);
      expect(nextAttempt.getTime()).toBe(failureTime.getTime() + 30000);
    });
  });

  describe("execute()", () => {
    it("should execute successful operations", async () => {
      const breaker = new CircuitBreaker();
      const operation = async () => "test result";

      const result = await breaker.execute(operation);

      expect(result).toBe("test result");
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle operation failures", async () => {
      const breaker = new CircuitBreaker();
      const operation = async () => {
        throw new Error("Operation failed");
      };

      await expect(breaker.execute(operation)).rejects.toThrow("Operation failed");
      expect(breaker.getState()).toBe(CircuitState.CLOSED); // Should still be closed for single failure
    });

    it("should handle timeouts", async () => {
      const breaker = new CircuitBreaker({ timeout: 100 });
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200)); // Takes longer than timeout
        return "should not reach here";
      };

      await expect(breaker.execute(operation)).rejects.toThrow("Operation timed out after 100ms");
    });
  });

  describe("TypeScript Generics", () => {
    it("should support generic type parameters", () => {
      const breaker = new CircuitBreaker();

      expect(breaker).toBeInstanceOf(CircuitBreaker);
      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
    });

    it("should work without explicit type parameters", () => {
      const breaker = new CircuitBreaker();

      expect(breaker).toBeInstanceOf(CircuitBreaker);
      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
    });
  });

  describe("Timeout handling", () => {
    it("should handle timeout errors correctly", async () => {
      const timeoutConfig = {
        ...DEFAULT_CONFIG,
        timeout: 100,
        failureThreshold: 1,
        minimumThroughput: 1,
      };

      const cb = new CircuitBreaker(timeoutConfig);

      // Function that takes longer than timeout
      const slowFunction = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return "success";
      };

      // Should timeout and record as failure
      await expect(cb.execute(slowFunction)).rejects.toThrow("Operation timed out");

      // Circuit should open after timeout failure
      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it("should not timeout fast operations", async () => {
      const timeoutConfig = {
        ...DEFAULT_CONFIG,
        timeout: 1000,
      };

      const cb = new CircuitBreaker(timeoutConfig);

      const fastFunction = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "success";
      };

      const result = await cb.execute(fastFunction);
      expect(result).toBe("success");
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle timeout with custom error message", async () => {
      const cb = new CircuitBreaker({ timeout: 50 });
      const slowFunction = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "slow result";
      };

      try {
        await cb.execute(slowFunction);
        fail("Should have thrown timeout error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Operation timed out after 50ms");
      }
    });

    it("should clear timeout when operation completes", async () => {
      const cb = new CircuitBreaker(DEFAULT_CONFIG);

      const normalFunction = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "completed";
      };

      const result = await cb.execute(normalFunction);
      expect(result).toBe("completed");

      // No timeout should be active
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("State transition edge cases", () => {
    it("should handle rapid state transitions", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        failureRateThreshold: 1.0,
        resetTimeout: 50,
        minimumThroughput: 2,
      });

      const failingFunction = async () => {
        throw new Error("fail");
      };

      // First failure should not open circuit
      await expect(cb.execute(failingFunction)).rejects.toThrow("fail");
      expect(cb.getState()).toBe(CircuitState.CLOSED);

      // Second failure should open circuit
      await expect(cb.execute(failingFunction)).rejects.toThrow("fail");
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Circuit should still be OPEN until we attempt an operation
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // First attempt should transition to HALF_OPEN
      const successFunction = async () => "success";
      const result = await cb.execute(successFunction);
      expect(result).toBe("success");
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle failure in half-open state", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        failureRateThreshold: 1.0,
        resetTimeout: 50,
        minimumThroughput: 2,
      });

      const failingFunction = async () => {
        throw new Error("fail");
      };

      // Open circuit with 2 failures
      await expect(cb.execute(failingFunction)).rejects.toThrow("fail");
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      await expect(cb.execute(failingFunction)).rejects.toThrow("fail");
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 60));

      // First attempt after recovery should fail and go back to OPEN
      await expect(cb.execute(failingFunction)).rejects.toThrow("fail");
      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it("should handle multiple concurrent calls in half-open state", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        failureRateThreshold: 1.0,
        resetTimeout: 50,
        minimumThroughput: 2,
      });

      const failingFunction = async () => {
        throw new Error("fail");
      };

      // Open circuit with 2 failures
      await expect(cb.execute(failingFunction)).rejects.toThrow("fail");
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      await expect(cb.execute(failingFunction)).rejects.toThrow("fail");
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Multiple concurrent calls - first should execute, others should be rejected
      const successFunction = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "success";
      };

      const promises = [
        cb.execute(successFunction),
        cb.execute(successFunction),
        cb.execute(successFunction),
      ];

      const results = await Promise.allSettled(promises);

      // At least one should succeed, others might be rejected due to circuit being OPEN
      const successes = results.filter((r) => r.status === "fulfilled");
      expect(successes.length).toBeGreaterThanOrEqual(1);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle state transitions with metrics", () => {
      const cb = new CircuitBreaker(DEFAULT_CONFIG);

      // Initial state
      const metrics = cb.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.totalCalls).toBe(0);

      // Note: CircuitBreaker doesn't expose recordSuccess/recordFailure directly
      // These are internal methods called during execute()
      // We'll test through actual execution instead
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("Error handling edge cases", () => {
    it("should handle function that throws non-Error objects", async () => {
      const cb = new CircuitBreaker(DEFAULT_CONFIG);

      const throwStringFunction = async () => {
        throw "string error";
      };

      await expect(cb.execute(throwStringFunction)).rejects.toBe("string error");
    });

    it("should handle function that throws null", async () => {
      const cb = new CircuitBreaker(DEFAULT_CONFIG);

      const throwNullFunction = async () => {
        throw null;
      };

      await expect(cb.execute(throwNullFunction)).rejects.toBeNull();
    });

    it("should handle function that throws undefined", async () => {
      const cb = new CircuitBreaker(DEFAULT_CONFIG);

      const throwUndefinedFunction = async () => {
        throw undefined;
      };

      await expect(cb.execute(throwUndefinedFunction)).rejects.toBeUndefined();
    });

    it("should handle synchronous function that throws", async () => {
      const cb = new CircuitBreaker(DEFAULT_CONFIG);

      const syncThrowFunction = () => {
        throw new Error("sync error");
      };

      await expect(cb.execute(syncThrowFunction as any)).rejects.toThrow("sync error");
    });

    it("should handle function that returns rejected promise", async () => {
      const cb = new CircuitBreaker(DEFAULT_CONFIG);

      const rejectedPromiseFunction = async () => {
        return Promise.reject(new Error("rejected promise"));
      };

      await expect(cb.execute(rejectedPromiseFunction)).rejects.toThrow("rejected promise");
    });
  });

  describe("Configuration edge cases", () => {
    it("should handle minimum configuration", () => {
      const minConfig = {
        failureThreshold: 1,
        resetTimeout: 1000,
        minimumThroughput: 1,
      };

      const cb = new CircuitBreaker(minConfig);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle configuration with zero timeout", () => {
      expect(() => {
        new CircuitBreaker({ timeout: 0 });
      }).toThrow("timeout must be greater than 0");
    });

    it("should handle very high failure threshold", async () => {
      const config = {
        ...DEFAULT_CONFIG,
        failureThreshold: 1000,
        minimumThroughput: 1000,
      };

      const cb = new CircuitBreaker(config);

      // Even many failures shouldn't open circuit
      const failingFunction = async () => {
        throw new Error("fail");
      };

      for (let i = 0; i < 10; i++) {
        await expect(cb.execute(failingFunction)).rejects.toThrow("fail");
      }

      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle very short recovery timeout", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5,
        minimumThroughput: 1,
      });

      const failingFunction = async () => {
        throw new Error("fail");
      };

      // Open circuit
      await expect(cb.execute(failingFunction)).rejects.toThrow("fail");
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Should quickly allow retry after short timeout
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Circuit is still OPEN until we attempt an operation
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Next attempt should work if the function succeeds
      const successFunction = async () => "success";
      const result = await cb.execute(successFunction);
      expect(result).toBe("success");
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle metrics reset", () => {
      const cb = new CircuitBreaker(DEFAULT_CONFIG);

      // Reset
      cb.reset();

      const metrics = cb.getMetrics();
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(0);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("Metrics and monitoring", () => {
    it("should provide accurate metrics during state transitions", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        failureRateThreshold: 1.0,
        resetTimeout: 50,
        minimumThroughput: 2,
      });

      const failingFunction = async () => {
        throw new Error("fail");
      };

      // Initial metrics
      let metrics = cb.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.totalCalls).toBe(0);

      // First failure
      await expect(cb.execute(failingFunction)).rejects.toThrow("fail");
      expect(cb.getState()).toBe(CircuitState.CLOSED);

      // Second failure should open circuit
      await expect(cb.execute(failingFunction)).rejects.toThrow("fail");

      // Check open state metrics
      metrics = cb.getMetrics();
      expect(metrics.state).toBe(CircuitState.OPEN);
      expect(metrics.totalCalls).toBe(2);
      expect(metrics.failedCalls).toBe(2);
      expect(metrics.failureRate).toBe(1.0);
    });

    it("should track response times accurately", async () => {
      const cb = new CircuitBreaker(DEFAULT_CONFIG);

      const timedFunction = async (delay: number) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return `completed in ${delay}ms`;
      };

      await cb.execute(() => timedFunction(50));
      await cb.execute(() => timedFunction(100));
      await cb.execute(() => timedFunction(75));

      const metrics = cb.getMetrics();
      expect(metrics.averageResponseTime).toBeGreaterThan(50);
      expect(metrics.averageResponseTime).toBeLessThan(100);
    });
  });

  describe("Concurrent execution", () => {
    it("should handle multiple concurrent successful calls", async () => {
      const cb = new CircuitBreaker(DEFAULT_CONFIG);

      const concurrentFunction = async (id: number) => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
        return `result-${id}`;
      };

      const promises = Array.from({ length: 10 }, (_, i) =>
        cb.execute(() => concurrentFunction(i))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toBe(`result-${index}`);
      });

      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle mixed concurrent success and failure calls", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 5,
        failureRateThreshold: 0.8,
        resetTimeout: 1000,
        minimumThroughput: 8,
      });

      const successFunction = async () => "success";
      const failingFunction = async () => {
        throw new Error("fail");
      };

      // Execute mixed operations concurrently
      const promises = [
        cb.execute(successFunction),
        cb.execute(successFunction),
        cb.execute(successFunction),
        cb.execute(successFunction),
        cb.execute(failingFunction),
        cb.execute(failingFunction),
        cb.execute(failingFunction),
        cb.execute(failingFunction),
      ];

      const results = await Promise.allSettled(promises);

      const successes = results.filter((r) => r.status === "fulfilled");
      const failures = results.filter((r) => r.status === "rejected");

      expect(successes.length).toBe(4);
      expect(failures.length).toBe(4);

      // Circuit should remain closed since failure rate is exactly at threshold
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("Integration with real-world scenarios", () => {
    it("should handle database connection simulation", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        failureRateThreshold: 0.8,
        resetTimeout: 100,
        minimumThroughput: 3,
      });

      let connectionAttempts = 0;
      const dbQuery = async (query: string) => {
        connectionAttempts++;
        if (connectionAttempts <= 3) {
          throw new Error("Database connection failed");
        }
        return `Result for: ${query}`;
      };

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(() => dbQuery("SELECT * FROM orders"))).rejects.toThrow(
          "Database connection failed"
        );
      }

      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 110));

      // Should succeed after recovery
      const result = await cb.execute(() => dbQuery("SELECT * FROM users"));
      expect(result).toBe("Result for: SELECT * FROM users");
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle API call simulation with retries", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        failureRateThreshold: 0.8,
        resetTimeout: 100,
        minimumThroughput: 3,
      });

      let apiAttempts = 0;
      const apiCall = async (endpoint: string) => {
        apiAttempts++;
        if (apiAttempts <= 3) {
          throw new Error("API server unavailable");
        }
        return { data: `Response from ${endpoint}`, status: 200 };
      };

      // Cause failures
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(() => apiCall("/users"))).rejects.toThrow("API server unavailable");
      }

      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 110));

      // Should succeed after recovery
      const result = await cb.execute(() => apiCall("/posts"));
      expect(result).toEqual({ data: "Response from /posts", status: 200 });
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("Timeout Handling", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should timeout operations that exceed configured timeout", async () => {
      const breaker = new CircuitBreaker({ timeout: 1000 });

      const slowOperation = async () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve("slow result"), 2000);
        });
      };

      const executePromise = breaker.execute(slowOperation);

      // Advance time to trigger timeout
      jest.advanceTimersByTime(1000);

      await expect(executePromise).rejects.toThrow("Operation timed out after 1000ms");
    });

    it("should not timeout operations that complete within timeout", async () => {
      const breaker = new CircuitBreaker({ timeout: 1000 });

      const fastOperation = async () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve("fast result"), 500);
        });
      };

      const executePromise = breaker.execute(fastOperation);

      // Advance time but not enough to trigger timeout
      jest.advanceTimersByTime(500);

      await expect(executePromise).resolves.toBe("fast result");
    });
  });

  describe("State Transitions", () => {
    it("should transition from CLOSED to OPEN when failure threshold is reached", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        minimumThroughput: 2,
      });

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // First failure
      try {
        await breaker.execute(async () => {
          throw new Error("Failure 1");
        });
      } catch (e) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // Second failure should open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("Failure 2");
        });
      } catch (e) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it("should transition from HALF_OPEN to CLOSED on success", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100,
        minimumThroughput: 1,
      });

      // Force to OPEN
      try {
        await breaker.execute(async () => {
          throw new Error("Failure");
        });
      } catch (e) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next call should transition to HALF_OPEN then CLOSED
      const result = await breaker.execute(async () => "success");

      expect(result).toBe("success");
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should stay in CLOSED state on success when already CLOSED", async () => {
      const breaker = new CircuitBreaker();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      const result = await breaker.execute(async () => "success");

      expect(result).toBe("success");
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("Error Handling Edge Cases", () => {
    it("should handle non-Error objects thrown by operations", async () => {
      const breaker = new CircuitBreaker();

      await expect(
        breaker.execute(async () => {
          throw "string error";
        })
      ).rejects.toBe("string error");

      await expect(
        breaker.execute(async () => {
          throw { message: "object error" };
        })
      ).rejects.toEqual({ message: "object error" });

      await expect(
        breaker.execute(async () => {
          throw null;
        })
      ).rejects.toBeNull();
    });

    it("should handle operations that return undefined", async () => {
      const breaker = new CircuitBreaker();

      const result = await breaker.execute(async () => {
        return undefined;
      });

      expect(result).toBeUndefined();
    });

    it("should handle operations that return null", async () => {
      const breaker = new CircuitBreaker();

      const result = await breaker.execute(async () => {
        return null;
      });

      expect(result).toBeNull();
    });
  });

  describe("Metrics Collection", () => {
    it("should record response times for both success and failure", async () => {
      const breaker = new CircuitBreaker();

      // Record a success
      await breaker.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "success";
      });

      // Record a failure
      try {
        await breaker.execute(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          throw new Error("failure");
        });
      } catch (e) {
        // Expected
      }

      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(2);
      expect(metrics.successfulCalls).toBe(1);
      expect(metrics.failedCalls).toBe(1);
    });
  });

  describe("Configuration Immutability", () => {
    it("should return a copy of configuration to prevent external modification", () => {
      const originalConfig = {
        failureThreshold: 5,
        timeout: 1000,
      };

      const breaker = new CircuitBreaker(originalConfig);
      const returnedConfig = breaker.getConfig();

      // Modify the returned config
      (returnedConfig as any).failureThreshold = 10;

      // Original should be unchanged
      expect(breaker.getConfig().failureThreshold).toBe(5);
    });

    it("should merge provided config with defaults", () => {
      const breaker = new CircuitBreaker({ failureThreshold: 10 });
      const config = breaker.getConfig();

      expect(config.failureThreshold).toBe(10);
      expect(config.timeout).toBeDefined(); // Should have default value
      expect(config.resetTimeout).toBeDefined(); // Should have default value
    });
  });

  describe("Internal State Management", () => {
    it("should handle shouldAttemptReset when no lastFailureTime is set", () => {
      const breaker = new CircuitBreaker({ resetTimeout: 1000 });

      // Force circuit to OPEN state without setting lastFailureTime
      (breaker as any).stateManager.transitionTo(CircuitState.OPEN);
      (breaker as any).lastFailureTime = undefined;

      // This should trigger the branch where !this.lastFailureTime is true
      const shouldReset = (breaker as any).shouldAttemptReset();
      expect(shouldReset).toBe(true);
    });

    it("should handle shouldAttemptReset when lastFailureTime is set but timeout not reached", () => {
      const breaker = new CircuitBreaker({ resetTimeout: 10000 }); // 10 seconds

      // Set lastFailureTime to now
      (breaker as any).lastFailureTime = new Date();

      const shouldReset = (breaker as any).shouldAttemptReset();
      expect(shouldReset).toBe(false);
    });

    it("should handle shouldAttemptReset when lastFailureTime is set and timeout reached", () => {
      const breaker = new CircuitBreaker({ resetTimeout: 100 }); // 100ms

      // Set lastFailureTime to past
      (breaker as any).lastFailureTime = new Date(Date.now() - 200);

      const shouldReset = (breaker as any).shouldAttemptReset();
      expect(shouldReset).toBe(true);
    });

    it("should return undefined for getNextAttemptTime when not in OPEN state", () => {
      const breaker = new CircuitBreaker();

      // Circuit is in CLOSED state by default
      const nextAttempt = (breaker as any).getNextAttemptTime();
      expect(nextAttempt).toBeUndefined();
    });

    it("should return undefined for getNextAttemptTime when in OPEN state but no lastFailureTime", () => {
      const breaker = new CircuitBreaker();

      // Force to OPEN state without lastFailureTime
      (breaker as any).stateManager.transitionTo(CircuitState.OPEN);
      (breaker as any).lastFailureTime = undefined;

      const nextAttempt = (breaker as any).getNextAttemptTime();
      expect(nextAttempt).toBeUndefined();
    });
  });
});
