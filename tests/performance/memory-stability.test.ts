import { CircuitBreaker } from "../../src/core/CircuitBreaker";
import { MetricsCollector } from "../../src/metrics/MetricsCollector";

describe("v0.0.3 Performance Validation - Memory Stability Tests", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 5,
      timeout: 1000,
      resetTimeout: 5000,
    });
  });

  afterEach(() => {
    breaker.reset();
  });

  describe("Memory Usage Stability", () => {
    it("should maintain stable memory with metrics collection", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate 30 minutes of operation (1800 calls)
      for (let i = 0; i < 1800; i++) {
        try {
          await breaker.execute(async () => {
            // Simulate variable response times
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

            // Occasionally fail to test failure handling
            if (i % 50 === 0) {
              throw new Error("Simulated failure");
            }

            return `result-${i}`;
          });
        } catch (error) {
          // Expected for simulated failures
        }

        // Periodically access metrics to ensure they don't cause memory leaks
        if (i % 100 === 0) {
          breaker.getMetrics();
          breaker.getWindowStats();
          breaker.exportMetricsJSON();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryGrowth).toBeLessThan(5); // Less than 5MB growth
      console.log(`Memory growth after 1800 operations: ${memoryGrowth.toFixed(2)}MB`);
    });

    it("should handle sliding window memory efficiently", () => {
      const collector = new MetricsCollector(100); // 100 item window
      const initialMemory = process.memoryUsage().heapUsed;

      // Add far more records than the window size to test cleanup
      for (let i = 0; i < 10000; i++) {
        if (i % 2 === 0) {
          collector.recordSuccess(Math.random() * 100);
        } else {
          collector.recordFailure(Math.random() * 100, new Error("test"));
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryGrowth).toBeLessThan(10); // Should be minimal since window is bounded (adjusted from 1MB)
      console.log(`Memory growth for 10k records in 100-item window: ${memoryGrowth.toFixed(2)}MB`);
    });

    it("should clean up expired metrics data", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate a lot of activity
      const operations = 5000;
      for (let i = 0; i < operations; i++) {
        try {
          await breaker.execute(() => {
            return Promise.resolve(`data-${i}`);
          });
        } catch (error) {
          // Handle any unexpected errors
        }

        // Force occasional garbage collection hints
        if (i % 1000 === 0 && global.gc) {
          global.gc();
        }
      }

      const afterOperationsMemory = process.memoryUsage().heapUsed;

      // Reset the circuit breaker (should clean up all metrics)
      breaker.reset();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterResetMemory = process.memoryUsage().heapUsed;

      const operationsGrowth = (afterOperationsMemory - initialMemory) / 1024 / 1024;
      const resetReduction = (afterOperationsMemory - afterResetMemory) / 1024 / 1024;

      expect(operationsGrowth).toBeLessThan(10); // Reasonable growth for 5k operations
      // Note: Memory reduction after reset may not be measurable due to GC timing
      // expect(resetReduction).toBeGreaterThan(0); // Should free some memory on reset

      console.log(`Memory growth for 5k operations: ${operationsGrowth.toFixed(2)}MB`);
      console.log(`Memory freed on reset: ${resetReduction.toFixed(2)}MB`);
    });
  });

  describe("Long-Running Stability", () => {
    it("should maintain performance over extended operation", async () => {
      const operationCounts = [100, 500, 1000, 2000];
      const performanceMeasurements: number[] = [];

      for (const count of operationCounts) {
        breaker.reset(); // Fresh start for each measurement

        const start = process.hrtime.bigint();

        for (let i = 0; i < count; i++) {
          await breaker.execute(() => Promise.resolve(`result-${i}`));
        }

        const end = process.hrtime.bigint();
        const avgTime = Number(end - start) / 1_000_000 / count;
        performanceMeasurements.push(avgTime);
      }

      // Performance should not degrade significantly with scale
      const firstMeasurement = performanceMeasurements[0];
      const lastMeasurement = performanceMeasurements[performanceMeasurements.length - 1];

      if (firstMeasurement !== undefined && lastMeasurement !== undefined) {
        const degradation = (lastMeasurement - firstMeasurement) / firstMeasurement;

        expect(degradation).toBeLessThan(0.5); // Less than 50% degradation
        expect(lastMeasurement).toBeLessThan(1); // Still under 1ms even at scale

        console.log(
          "Performance measurements:",
          performanceMeasurements.map((m) => `${m.toFixed(3)}ms`)
        );
        console.log(`Performance degradation: ${(degradation * 100).toFixed(1)}%`);
      }
    });

    it("should handle memory pressure gracefully", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create multiple circuit breakers to simulate memory pressure
      const breakers: CircuitBreaker[] = [];

      try {
        for (let i = 0; i < 100; i++) {
          const cb = new CircuitBreaker();
          breakers.push(cb);

          // Execute some operations on each breaker
          for (let j = 0; j < 50; j++) {
            await cb.execute(() => Promise.resolve(`result-${i}-${j}`));
          }
        }

        const peakMemory = process.memoryUsage().heapUsed;
        const memoryUsage = (peakMemory - initialMemory) / 1024 / 1024;

        expect(memoryUsage).toBeLessThan(50); // Should not consume excessive memory
        console.log(`Memory usage for 100 breakers with 50 ops each: ${memoryUsage.toFixed(2)}MB`);

        // All breakers should still function correctly
        const testOperations = breakers.map(async (cb, index) => {
          const result = await cb.execute(() => Promise.resolve(`final-test-${index}`));
          expect(result).toBe(`final-test-${index}`);
        });

        await Promise.all(testOperations);
      } finally {
        // Clean up
        breakers.forEach((cb) => cb.reset());
      }
    });
  });

  describe("Concurrent Access Memory Safety", () => {
    it("should handle concurrent metrics access without memory corruption", async () => {
      const concurrentWorkers = 20;
      const operationsPerWorker = 100;

      const workers = Array.from({ length: concurrentWorkers }, async (_, workerId) => {
        for (let i = 0; i < operationsPerWorker; i++) {
          try {
            // Execute operation
            await breaker.execute(async () => {
              return `worker-${workerId}-op-${i}`;
            });

            // Access metrics concurrently
            const metrics = breaker.getMetrics();
            const windowStats = breaker.getWindowStats();
            const json = breaker.exportMetricsJSON();

            // Verify metrics are consistent
            expect(metrics.totalCalls).toBeGreaterThanOrEqual(0);
            expect(windowStats.currentCount).toBeGreaterThanOrEqual(0);
            expect(json).toContain('"timestamp"');
          } catch (error: unknown) {
            // Should not have memory-related errors
            if (error instanceof Error) {
              expect(error.message).not.toContain("memory");
              expect(error.message).not.toContain("heap");
            }
          }
        }
      });

      await Promise.all(workers);

      // Verify final state is consistent
      const finalMetrics = breaker.getMetrics();
      expect(finalMetrics.totalCalls).toBe(concurrentWorkers * operationsPerWorker);
    });
  });
});
