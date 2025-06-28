import { MetricsCollector } from "../../src/metrics/MetricsCollector";
import { CircuitState } from "../../src/types/index";

describe("MetricsCollector", () => {
  let metricsCollector: MetricsCollector;
  const windowSize = 10;

  beforeEach(() => {
    metricsCollector = new MetricsCollector(windowSize);
  });

  describe("Constructor", () => {
    it("should create instance with default window size", () => {
      const collector = new MetricsCollector();
      expect(collector).toBeInstanceOf(MetricsCollector);
      expect(collector.getWindowCallCount()).toBe(0);
    });

    it("should create instance with custom window size", () => {
      const customCollector = new MetricsCollector(50);
      expect(customCollector.getWindowCallCount()).toBe(0);
    });

    it("should initialize with zero metrics", () => {
      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());

      expect(metrics.totalCalls).toBe(0);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.failureRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });
  });

  describe("recordSuccess", () => {
    it("should record successful operation", () => {
      const responseTime = 100;
      metricsCollector.recordSuccess(responseTime);

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(1);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.failureRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(responseTime);
    });

    it("should record multiple successful operations", () => {
      const responseTimes = [100, 200, 150];
      responseTimes.forEach((time) => metricsCollector.recordSuccess(time));

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(metrics.totalCalls).toBe(3);
      expect(metrics.successfulCalls).toBe(3);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.failureRate).toBe(0);

      const expectedAverage = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      expect(metrics.averageResponseTime).toBe(expectedAverage);
    });

    it("should update sliding window", () => {
      metricsCollector.recordSuccess(100);
      expect(metricsCollector.getWindowCallCount()).toBe(1);
      expect(metricsCollector.getFailureRate()).toBe(0);
    });
  });

  describe("recordFailure", () => {
    it("should record failed operation without error", () => {
      const responseTime = 50;
      metricsCollector.recordFailure(responseTime);

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(1);
      expect(metrics.failureRate).toBe(1);
      expect(metrics.averageResponseTime).toBe(responseTime);
    });

    it("should record failed operation with error", () => {
      const responseTime = 75;
      const error = new Error("Test error");
      metricsCollector.recordFailure(responseTime, error);

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(1);
      expect(metrics.failureRate).toBe(1);
      expect(metrics.averageResponseTime).toBe(responseTime);
    });

    it("should record multiple failed operations", () => {
      const responseTimes = [50, 75, 100];
      responseTimes.forEach((time) => metricsCollector.recordFailure(time));

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(metrics.totalCalls).toBe(3);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(3);
      expect(metrics.failureRate).toBe(1);

      const expectedAverage = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      expect(metrics.averageResponseTime).toBe(expectedAverage);
    });

    it("should update sliding window", () => {
      metricsCollector.recordFailure(100);
      expect(metricsCollector.getWindowCallCount()).toBe(1);
      expect(metricsCollector.getFailureRate()).toBe(1);
    });
  });

  describe("getFailureRate", () => {
    it("should return 0 when no calls recorded", () => {
      expect(metricsCollector.getFailureRate()).toBe(0);
    });

    it("should calculate correct failure rate with mixed calls", () => {
      // Record 2 successes and 3 failures
      metricsCollector.recordSuccess(100);
      metricsCollector.recordSuccess(150);
      metricsCollector.recordFailure(50);
      metricsCollector.recordFailure(75);
      metricsCollector.recordFailure(100);

      expect(metricsCollector.getFailureRate()).toBe(0.6); // 3/5
    });

    it("should return 1 when all calls are failures", () => {
      metricsCollector.recordFailure(50);
      metricsCollector.recordFailure(75);
      expect(metricsCollector.getFailureRate()).toBe(1);
    });

    it("should return 0 when all calls are successes", () => {
      metricsCollector.recordSuccess(100);
      metricsCollector.recordSuccess(150);
      expect(metricsCollector.getFailureRate()).toBe(0);
    });

    it("should handle sliding window overflow", () => {
      // Fill window with successes
      for (let i = 0; i < windowSize; i++) {
        metricsCollector.recordSuccess(100);
      }
      expect(metricsCollector.getFailureRate()).toBe(0);

      // Add failures that will push out successes
      for (let i = 0; i < windowSize; i++) {
        metricsCollector.recordFailure(50);
      }
      expect(metricsCollector.getFailureRate()).toBe(1);
    });
  });

  describe("getWindowCallCount", () => {
    it("should return 0 initially", () => {
      expect(metricsCollector.getWindowCallCount()).toBe(0);
    });

    it("should count all calls in sliding window", () => {
      metricsCollector.recordSuccess(100);
      metricsCollector.recordFailure(50);
      metricsCollector.recordSuccess(150);

      expect(metricsCollector.getWindowCallCount()).toBe(3);
    });

    it("should not exceed window size", () => {
      // Add more calls than window size
      for (let i = 0; i < windowSize + 5; i++) {
        if (i % 2 === 0) {
          metricsCollector.recordSuccess(100);
        } else {
          metricsCollector.recordFailure(50);
        }
      }

      expect(metricsCollector.getWindowCallCount()).toBe(windowSize);
    });
  });

  describe("getMetrics", () => {
    it("should return complete metrics snapshot", () => {
      const currentState = CircuitState.HALF_OPEN;
      const lastStateChange = new Date();

      // Record some data
      metricsCollector.recordSuccess(100);
      metricsCollector.recordFailure(50);
      metricsCollector.recordSuccess(150);

      const metrics = metricsCollector.getMetrics(currentState, lastStateChange);

      expect(metrics.state).toBe(currentState);
      expect(metrics.totalCalls).toBe(3);
      expect(metrics.successfulCalls).toBe(2);
      expect(metrics.failedCalls).toBe(1);
      expect(metrics.failureRate).toBe(1 / 3); // 1 failure out of 3 total calls
      expect(metrics.averageResponseTime).toBe((100 + 50 + 150) / 3);
      expect(metrics.lastStateChange).toBe(lastStateChange);
      expect(metrics.nextAttempt).toBeUndefined();
    });

    it("should include nextAttempt when provided", () => {
      const currentState = CircuitState.OPEN;
      const lastStateChange = new Date();
      const nextAttempt = new Date(Date.now() + 60000);

      const metrics = metricsCollector.getMetrics(currentState, lastStateChange, nextAttempt);

      expect(metrics.state).toBe(currentState);
      expect(metrics.lastStateChange).toBe(lastStateChange);
      expect(metrics.nextAttempt).toBe(nextAttempt);
    });

    it("should return new object each time", () => {
      const state = CircuitState.CLOSED;
      const timestamp = new Date();

      const metrics1 = metricsCollector.getMetrics(state, timestamp);
      const metrics2 = metricsCollector.getMetrics(state, timestamp);

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });
  });

  describe("reset", () => {
    it("should reset all metrics to initial state", () => {
      // Record some data
      metricsCollector.recordSuccess(100);
      metricsCollector.recordFailure(50);
      metricsCollector.recordSuccess(150);

      // Verify data exists
      expect(metricsCollector.getWindowCallCount()).toBe(3);
      const beforeReset = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(beforeReset.totalCalls).toBe(3);

      // Reset
      metricsCollector.reset();

      // Verify reset
      expect(metricsCollector.getWindowCallCount()).toBe(0);
      expect(metricsCollector.getFailureRate()).toBe(0);

      const afterReset = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(afterReset.totalCalls).toBe(0);
      expect(afterReset.successfulCalls).toBe(0);
      expect(afterReset.failedCalls).toBe(0);
      expect(afterReset.failureRate).toBe(0);
      expect(afterReset.averageResponseTime).toBe(0);
    });

    it("should allow recording new data after reset", () => {
      // Record, reset, then record again
      metricsCollector.recordSuccess(100);
      metricsCollector.reset();
      metricsCollector.recordFailure(50);

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(1);
      expect(metrics.failureRate).toBe(1);
      expect(metrics.averageResponseTime).toBe(50);
    });
  });

  describe("Response time tracking", () => {
    it("should track response times correctly", () => {
      const responseTimes = [100, 200, 150, 300, 250];
      responseTimes.forEach((time) => metricsCollector.recordSuccess(time));

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      const expectedAverage = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      expect(metrics.averageResponseTime).toBe(expectedAverage);
    });

    it("should handle response time overflow (max 100 response times)", () => {
      // Record more than 100 response times
      for (let i = 1; i <= 150; i++) {
        metricsCollector.recordSuccess(i);
      }

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());

      // Should only keep the last 100 response times (51-150)
      const expectedSum = Array.from({ length: 100 }, (_, i) => i + 51).reduce((a, b) => a + b);
      const expectedAverage = expectedSum / 100;
      expect(metrics.averageResponseTime).toBe(expectedAverage);
    });

    it("should return 0 average when no response times recorded", () => {
      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(metrics.averageResponseTime).toBe(0);
    });

    it("should handle mixed success and failure response times", () => {
      metricsCollector.recordSuccess(100);
      metricsCollector.recordFailure(200);
      metricsCollector.recordSuccess(150);
      metricsCollector.recordFailure(250);

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      const expectedAverage = (100 + 200 + 150 + 250) / 4;
      expect(metrics.averageResponseTime).toBe(expectedAverage);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle high-frequency operations", () => {
      // Simulate high-frequency operations
      for (let i = 0; i < 1000; i++) {
        if (i % 3 === 0) {
          metricsCollector.recordFailure(50 + (i % 100));
        } else {
          metricsCollector.recordSuccess(100 + (i % 200));
        }
      }

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(metrics.totalCalls).toBe(1000);

      // Calculate expected values: i % 3 === 0 means i = 0,3,6,9...
      // For i from 0 to 999: failures occur at 0,3,6,9...999
      // That's Math.floor(1000/3) + 1 = 333 + 1 = 334 failures (including 0)
      // But actually it's 334 failures: 0,3,6,...,999 = (999-0)/3 + 1 = 334
      const expectedFailures = Math.floor(1000 / 3) + 1; // 334
      const expectedSuccesses = 1000 - expectedFailures; // 666

      expect(metrics.successfulCalls).toBe(expectedSuccesses);
      expect(metrics.failedCalls).toBe(expectedFailures);
      expect(metrics.failureRate).toBeCloseTo(expectedFailures / 1000, 3);

      // Sliding window should only contain last windowSize calls
      expect(metricsCollector.getWindowCallCount()).toBe(windowSize);
    });

    it("should maintain accuracy during sliding window transitions", () => {
      // Fill window with successes
      for (let i = 0; i < windowSize; i++) {
        metricsCollector.recordSuccess(100);
      }

      expect(metricsCollector.getFailureRate()).toBe(0);
      expect(metricsCollector.getWindowCallCount()).toBe(windowSize);

      // Add one failure (should push out one success)
      metricsCollector.recordFailure(50);

      expect(metricsCollector.getFailureRate()).toBe(1 / windowSize);
      expect(metricsCollector.getWindowCallCount()).toBe(windowSize);
    });

    it("should handle edge case with single call", () => {
      metricsCollector.recordSuccess(100);

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(1);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.failureRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(100);
      expect(metricsCollector.getFailureRate()).toBe(0);
    });

    it("should handle alternating success/failure pattern", () => {
      // Alternate between success and failure
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          metricsCollector.recordSuccess(100);
        } else {
          metricsCollector.recordFailure(50);
        }
      }

      const metrics = metricsCollector.getMetrics(CircuitState.CLOSED, new Date());
      expect(metrics.totalCalls).toBe(20);
      expect(metrics.successfulCalls).toBe(10);
      expect(metrics.failedCalls).toBe(10);
      expect(metrics.failureRate).toBe(0.5);

      // Sliding window failure rate should also be 0.5
      expect(metricsCollector.getFailureRate()).toBe(0.5);
    });
  });

  describe("v0.0.3 Export Functionality", () => {
    describe("exportJSON", () => {
      it("should export metrics as valid JSON", () => {
        // Add some test data
        metricsCollector.recordSuccess(100);
        metricsCollector.recordSuccess(150);
        metricsCollector.recordFailure(200, new Error("test error"));

        const currentState = CircuitState.CLOSED;
        const lastStateChange = new Date("2023-01-01T10:00:00Z");

        const jsonString = metricsCollector.exportJSON(currentState, lastStateChange);

        // Should be valid JSON
        expect(() => JSON.parse(jsonString)).not.toThrow();

        const exported = JSON.parse(jsonString);

        // Should have expected structure
        expect(exported).toHaveProperty("timestamp");
        expect(exported).toHaveProperty("circuitBreaker");

        // Should contain metrics data
        const cb = exported.circuitBreaker;
        expect(cb.state).toBe(CircuitState.CLOSED);
        expect(cb.totalCalls).toBe(3);
        expect(cb.successfulCalls).toBe(2);
        expect(cb.failedCalls).toBe(1);
        expect(cb.lastStateChange).toBe("2023-01-01T10:00:00.000Z");
      });

      it("should include nextAttempt when provided", () => {
        metricsCollector.recordFailure(100, new Error("test"));

        const currentState = CircuitState.OPEN;
        const lastStateChange = new Date("2023-01-01T10:00:00Z");
        const nextAttempt = new Date("2023-01-01T10:05:00Z");

        const jsonString = metricsCollector.exportJSON(currentState, lastStateChange, nextAttempt);
        const exported = JSON.parse(jsonString);

        expect(exported.circuitBreaker.nextAttempt).toBe("2023-01-01T10:05:00.000Z");
      });

      it("should format JSON with proper indentation", () => {
        metricsCollector.recordSuccess(100);

        const jsonString = metricsCollector.exportJSON(CircuitState.CLOSED, new Date());

        // Should be formatted with 2-space indentation
        expect(jsonString).toContain('  "timestamp"');
        expect(jsonString).toContain('  "circuitBreaker"');
      });

      it("should include timestamp in ISO format", () => {
        const before = new Date().toISOString();
        const jsonString = metricsCollector.exportJSON(CircuitState.CLOSED, new Date());
        const after = new Date().toISOString();

        const exported = JSON.parse(jsonString);
        const timestamp = exported.timestamp;

        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(timestamp >= before).toBe(true);
        expect(timestamp <= after).toBe(true);
      });
    });

    describe("getWindowStats", () => {
      it("should return correct window statistics", () => {
        // Create collector with specific window size
        const collector = new MetricsCollector(50);

        // Add some data
        for (let i = 0; i < 30; i++) {
          collector.recordSuccess(100);
        }
        for (let i = 0; i < 10; i++) {
          collector.recordFailure(150, new Error("test"));
        }

        const stats = collector.getWindowStats();

        expect(stats.windowSize).toBe(50);
        expect(stats.currentCount).toBe(40); // 30 success + 10 failures
        expect(stats.failureRate).toBe(0.25); // 10 failures out of 40 total
      });

      it("should handle empty window", () => {
        const stats = metricsCollector.getWindowStats();

        expect(stats.windowSize).toBeGreaterThan(0);
        expect(stats.currentCount).toBe(0);
        expect(stats.failureRate).toBe(0);
      });

      it("should reflect sliding window behavior", () => {
        const collector = new MetricsCollector(5); // Small window for testing

        // Fill window completely
        for (let i = 0; i < 5; i++) {
          collector.recordSuccess(100);
        }

        let stats = collector.getWindowStats();
        expect(stats.currentCount).toBe(5);
        expect(stats.failureRate).toBe(0);

        // Add more records to test sliding
        collector.recordFailure(150, new Error("test"));
        collector.recordFailure(150, new Error("test"));

        stats = collector.getWindowStats();
        expect(stats.currentCount).toBe(5); // Window size limit
        expect(stats.failureRate).toBe(0.4); // 2 failures out of 5 total
      });

      it("should match sliding window failure rate", () => {
        // Add test data
        for (let i = 0; i < 20; i++) {
          if (i % 3 === 0) {
            metricsCollector.recordFailure(100, new Error("test"));
          } else {
            metricsCollector.recordSuccess(100);
          }
        }

        const stats = metricsCollector.getWindowStats();
        const directFailureRate = metricsCollector.getFailureRate();

        expect(stats.failureRate).toBe(directFailureRate);
      });
    });

    describe("Export Performance", () => {
      it("should export quickly with large dataset", () => {
        // Add significant amount of data
        for (let i = 0; i < 1000; i++) {
          metricsCollector.recordSuccess(Math.random() * 200);
        }

        const start = process.hrtime.bigint();
        const jsonString = metricsCollector.exportJSON(CircuitState.CLOSED, new Date());
        const end = process.hrtime.bigint();

        const exportTime = Number(end - start) / 1_000_000; // Convert to ms

        expect(exportTime).toBeLessThan(10); // Should be very fast
        expect(jsonString).toContain('"totalCalls": 1000');
      });

      it("should get window stats quickly", () => {
        // Add some test data
        for (let i = 0; i < 500; i++) {
          metricsCollector.recordSuccess(100);
        }

        const iterations = 1000;
        const start = process.hrtime.bigint();

        for (let i = 0; i < iterations; i++) {
          const stats = metricsCollector.getWindowStats();
          expect(stats).toBeDefined();
        }

        const end = process.hrtime.bigint();
        const avgTime = Number(end - start) / 1_000_000 / iterations;

        expect(avgTime).toBeLessThan(1); // Window stats should be very fast (adjusted from 0.1ms)
      });
    });
  });
});
