import {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerError,
  Operation,
  DEFAULT_CONFIG,
} from "../../src/types/index";

describe("Types", () => {
  describe("CircuitState", () => {
    it("should have correct enum values", () => {
      expect(CircuitState.CLOSED).toBe("CLOSED");
      expect(CircuitState.OPEN).toBe("OPEN");
      expect(CircuitState.HALF_OPEN).toBe("HALF_OPEN");
    });

    it("should be usable in type guards", () => {
      const state: CircuitState = CircuitState.CLOSED;
      expect(Object.values(CircuitState)).toContain(state);
    });
  });

  describe("DEFAULT_CONFIG", () => {
    it("should have all required configuration properties", () => {
      expect(DEFAULT_CONFIG).toHaveProperty("failureThreshold");
      expect(DEFAULT_CONFIG).toHaveProperty("failureRateThreshold");
      expect(DEFAULT_CONFIG).toHaveProperty("timeout");
      expect(DEFAULT_CONFIG).toHaveProperty("resetTimeout");
      expect(DEFAULT_CONFIG).toHaveProperty("minimumThroughput");
    });

    it("should have sensible default values", () => {
      expect(DEFAULT_CONFIG.failureThreshold).toBe(5);
      expect(DEFAULT_CONFIG.failureRateThreshold).toBe(0.5);
      expect(DEFAULT_CONFIG.timeout).toBe(3000);
      expect(DEFAULT_CONFIG.resetTimeout).toBe(60000);
      expect(DEFAULT_CONFIG.minimumThroughput).toBe(10);
    });

    it("should have valid value ranges", () => {
      expect(DEFAULT_CONFIG.failureThreshold).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.failureRateThreshold).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CONFIG.failureRateThreshold).toBeLessThanOrEqual(1);
      expect(DEFAULT_CONFIG.timeout).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.resetTimeout).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.minimumThroughput).toBeGreaterThan(0);
    });
  });

  describe("CircuitBreakerError", () => {
    it("should create error with correct properties", () => {
      const error = new CircuitBreakerError("Test error", CircuitState.OPEN);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CircuitBreakerError);
      expect(error.message).toBe("Test error");
      expect(error.state).toBe(CircuitState.OPEN);
      expect(error.name).toBe("CircuitBreakerError");
    });

    it("should maintain proper stack trace", () => {
      const error = new CircuitBreakerError("Test error", CircuitState.OPEN);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("CircuitBreakerError");
    });

    it("should be throwable and catchable", () => {
      expect(() => {
        throw new CircuitBreakerError("Test error", CircuitState.OPEN);
      }).toThrow(CircuitBreakerError);

      try {
        throw new CircuitBreakerError("Test error", CircuitState.OPEN);
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerError);
        if (error instanceof CircuitBreakerError) {
          expect(error.state).toBe(CircuitState.OPEN);
        }
      }
    });
  });

  describe("Type Safety", () => {
    it("should enforce CircuitBreakerConfig interface", () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 10,
        failureRateThreshold: 0.6,
        timeout: 5000,
        resetTimeout: 30000,
        minimumThroughput: 5,
      };

      expect(config.failureThreshold).toBe(10);
      expect(config.failureRateThreshold).toBe(0.6);
      expect(config.timeout).toBe(5000);
      expect(config.resetTimeout).toBe(30000);
      expect(config.minimumThroughput).toBe(5);
    });

    it("should enforce CircuitBreakerMetrics interface", () => {
      const metrics: CircuitBreakerMetrics = {
        state: CircuitState.CLOSED,
        totalCalls: 100,
        successfulCalls: 95,
        failedCalls: 5,
        failureRate: 0.05,
        averageResponseTime: 150,
        lastStateChange: new Date(),
      };

      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.totalCalls).toBe(100);
      expect(metrics.successfulCalls).toBe(95);
      expect(metrics.failedCalls).toBe(5);
      expect(metrics.failureRate).toBe(0.05);
      expect(metrics.averageResponseTime).toBe(150);
      expect(metrics.lastStateChange).toBeInstanceOf(Date);
    });

    it("should enforce Operation type", () => {
      const operation: Operation<string> = async () => "test result";

      expect(typeof operation).toBe("function");
      expect(operation()).toBeInstanceOf(Promise);
    });
  });
});
