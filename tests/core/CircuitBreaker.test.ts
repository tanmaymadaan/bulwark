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

      expect(metrics1).toEqual(metrics2);
      expect(metrics1).not.toBe(metrics2);
    });
  });

  describe("reset()", () => {
    it("should reset circuit breaker to initial state", () => {
      const breaker = new CircuitBreaker();

      // Reset should work even in initial state
      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.failureRate).toBe(0);
      expect(metrics.nextAttempt).toBeUndefined();
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
