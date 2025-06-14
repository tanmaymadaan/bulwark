/**
 * Tests for main index.ts exports
 */

import * as BulwarkExports from "../src/index";
import { CircuitBreaker } from "../src/core/CircuitBreaker";
import { CircuitState, CircuitBreakerError, DEFAULT_CONFIG } from "../src/types/index";

describe("Main Index Exports", () => {
  describe("Core Exports", () => {
    it("should export CircuitBreaker class", () => {
      expect(BulwarkExports.CircuitBreaker).toBe(CircuitBreaker);
      expect(typeof BulwarkExports.CircuitBreaker).toBe("function");
    });

    it("should allow creating CircuitBreaker instances", () => {
      const breaker = new BulwarkExports.CircuitBreaker();
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });
  });

  describe("Type Exports", () => {
    it("should export CircuitState enum", () => {
      expect(BulwarkExports.CircuitState).toBe(CircuitState);
      expect(BulwarkExports.CircuitState.CLOSED).toBe("CLOSED");
      expect(BulwarkExports.CircuitState.OPEN).toBe("OPEN");
      expect(BulwarkExports.CircuitState.HALF_OPEN).toBe("HALF_OPEN");
    });

    it("should export CircuitBreakerError class", () => {
      expect(BulwarkExports.CircuitBreakerError).toBe(CircuitBreakerError);
      const error = new BulwarkExports.CircuitBreakerError("test", CircuitState.OPEN);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("CircuitBreakerError");
    });

    it("should export DEFAULT_CONFIG", () => {
      expect(BulwarkExports.DEFAULT_CONFIG).toBe(DEFAULT_CONFIG);
      expect(typeof BulwarkExports.DEFAULT_CONFIG).toBe("object");
      expect(BulwarkExports.DEFAULT_CONFIG.failureThreshold).toBe(5);
    });
  });

  describe("Type Interfaces", () => {
    it("should export CircuitBreakerConfig type", () => {
      // Test that the type is available by using it
      const config: BulwarkExports.CircuitBreakerConfig = {
        failureThreshold: 3,
        failureRateThreshold: 0.5,
        timeout: 2000,
        resetTimeout: 30000,
        minimumThroughput: 5,
      };
      expect(config.failureThreshold).toBe(3);
    });

    it("should export CircuitBreakerMetrics type", () => {
      // Test that the type is available by using it
      const metrics: BulwarkExports.CircuitBreakerMetrics = {
        state: CircuitState.CLOSED,
        totalCalls: 10,
        successfulCalls: 8,
        failedCalls: 2,
        failureRate: 0.2,
        averageResponseTime: 150,
        lastStateChange: new Date(),
      };
      expect(metrics.totalCalls).toBe(10);
    });

    it("should export Operation type", () => {
      // Test that the type is available by using it
      const operation: BulwarkExports.Operation<string> = async () => "test";
      expect(typeof operation).toBe("function");
    });
  });

  describe("Version Export", () => {
    it("should export VERSION constant", () => {
      expect(BulwarkExports.VERSION).toBe("0.0.2");
      expect(typeof BulwarkExports.VERSION).toBe("string");
    });
  });

  describe("Complete Export Coverage", () => {
    it("should export all expected members", () => {
      const expectedExports = [
        "CircuitBreaker",
        "CircuitState",
        "CircuitBreakerError",
        "TimeoutError",
        "DEFAULT_CONFIG",
        "VERSION",
      ];

      expectedExports.forEach((exportName) => {
        expect(BulwarkExports).toHaveProperty(exportName);
      });
    });

    it("should not export unexpected members", () => {
      const expectedExports = [
        "CircuitBreaker",
        "CircuitState",
        "CircuitBreakerError",
        "TimeoutError",
        "DEFAULT_CONFIG",
        "VERSION",
        // Utility exports for advanced users
        "SlidingWindow",
        "MetricsCollector",
        "FailureDetector",
        "StateManager",
      ];

      const actualExports = Object.keys(BulwarkExports);

      // All actual exports should be expected
      actualExports.forEach((exportName) => {
        expect(expectedExports).toContain(exportName);
      });
    });
  });
});
