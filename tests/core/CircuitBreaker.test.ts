import { CircuitBreaker } from "../../src/core/CircuitBreaker";
import { CircuitState, CircuitBreakerConfig, DEFAULT_CONFIG } from "../../src/types/index";

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

      // Manually set state to OPEN with lastFailureTime
      (breaker as any).state = CircuitState.OPEN;
      (breaker as any).lastFailureTime = failureTime;

      const metrics = breaker.getMetrics();

      expect(metrics.state).toBe(CircuitState.OPEN);
      expect(metrics.nextAttempt).toBeInstanceOf(Date);
      expect(metrics.nextAttempt!.getTime()).toBe(failureTime.getTime() + 30000);
    });

    it("should calculate failure rate correctly", () => {
      const breaker = new CircuitBreaker();

      // Manually set some counts to test failure rate calculation
      (breaker as any).successCount = 7;
      (breaker as any).failureCount = 3;

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

      // Reset and check state
      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.failureRate).toBe(0);
    });

    it("should update lastStateChange when reset", () => {
      const breaker = new CircuitBreaker();
      const beforeReset = new Date();

      breaker.reset();

      const metrics = breaker.getMetrics();
      expect(metrics.lastStateChange.getTime()).toBeGreaterThanOrEqual(beforeReset.getTime());
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

      // Manually set state to OPEN with lastFailureTime
      (breaker as any).state = CircuitState.OPEN;
      (breaker as any).lastFailureTime = failureTime;

      const getNextAttemptTime = (breaker as any).getNextAttemptTime.bind(breaker);
      const nextAttempt = getNextAttemptTime();

      expect(nextAttempt).toBeInstanceOf(Date);
      expect(nextAttempt.getTime()).toBe(failureTime.getTime() + 30000);
    });
  });

  describe("execute()", () => {
    it("should throw not implemented error", async () => {
      const breaker = new CircuitBreaker();
      const operation = async () => "test";

      await expect(breaker.execute(operation)).rejects.toThrow(
        "Not implemented - will be added in v0.0.2"
      );
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
});
