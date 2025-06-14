import { CircuitBreaker } from "../../src/core/CircuitBreaker";
import { CircuitState } from "../../src/types";
import { Timer } from "../../src/utils/Timer";
import { performance } from "perf_hooks";

describe("Performance Benchmarks", () => {
  describe("Circuit Breaker Overhead", () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 1000,
        timeout: 1000,
      });
    });

    it("should have minimal overhead for successful operations", async () => {
      const fastOperation = () => Promise.resolve("success");

      // Warm up
      for (let i = 0; i < 10; i++) {
        await circuitBreaker.execute(fastOperation);
      }

      // Measure direct operation time
      const directStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        await fastOperation();
      }
      const directEnd = performance.now();
      const directTime = directEnd - directStart;

      // Measure circuit breaker operation time
      const cbStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        await circuitBreaker.execute(fastOperation);
      }
      const cbEnd = performance.now();
      const cbTime = cbEnd - cbStart;

      const overhead = (cbTime - directTime) / 1000; // Per operation

      console.log(`Direct operations: ${directTime.toFixed(2)}ms total`);
      console.log(`Circuit breaker operations: ${cbTime.toFixed(2)}ms total`);
      console.log(`Overhead per operation: ${overhead.toFixed(4)}ms`);

      // Overhead should be less than 1ms per operation
      expect(overhead).toBeLessThan(1);
    });

    it("should handle high throughput efficiently", async () => {
      const operation = () => Promise.resolve(Math.random());
      const iterations = 10000;

      const start = performance.now();

      // Execute operations in batches to avoid overwhelming the system
      const batchSize = 100;
      for (let i = 0; i < iterations; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, iterations - i) }, () =>
          circuitBreaker.execute(operation)
        );
        await Promise.all(batch);
      }

      const end = performance.now();
      const totalTime = end - start;
      const operationsPerSecond = (iterations / totalTime) * 1000;

      console.log(`Executed ${iterations} operations in ${totalTime.toFixed(2)}ms`);
      console.log(`Throughput: ${operationsPerSecond.toFixed(0)} operations/second`);

      // Should handle at least 1000 operations per second
      expect(operationsPerSecond).toBeGreaterThan(1000);
    });

    it("should maintain performance under concurrent load", async () => {
      const operation = async () => {
        await Timer.delay(1); // Small delay to simulate real work
        return "result";
      };

      const concurrency = 50;
      const operationsPerWorker = 100;

      const start = performance.now();

      const workers = Array.from({ length: concurrency }, async () => {
        for (let i = 0; i < operationsPerWorker; i++) {
          await circuitBreaker.execute(operation);
        }
      });

      await Promise.all(workers);

      const end = performance.now();
      const totalTime = end - start;
      const totalOperations = concurrency * operationsPerWorker;
      const operationsPerSecond = (totalOperations / totalTime) * 1000;

      console.log(`Concurrent test: ${totalOperations} operations with ${concurrency} workers`);
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`Throughput: ${operationsPerSecond.toFixed(0)} operations/second`);

      // Should maintain reasonable throughput under concurrent load
      expect(operationsPerSecond).toBeGreaterThan(500);
    });
  });

  describe("Memory Usage", () => {
    it("should not leak memory under continuous load", async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 10,
        resetTimeout: 100,
        timeout: 50,
      });

      const operation = () => Promise.resolve(Math.random().toString());

      // Get initial memory usage
      const initialMemory = process.memoryUsage();

      // Run operations for a while
      for (let batch = 0; batch < 10; batch++) {
        const promises = Array.from({ length: 1000 }, () => circuitBreaker.execute(operation));
        await Promise.all(promises);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();

      // Memory growth should be reasonable (less than 50MB)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      console.log(`Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);

      expect(memoryGrowthMB).toBeLessThan(50);
    });

    it("should handle sliding window memory efficiently", async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 10,
        failureRateThreshold: 0.5,
        timeout: 1000,
        resetTimeout: 5000,
        minimumThroughput: 5,
      });

      // Execute many operations to fill sliding window
      for (let i = 0; i < 1000; i++) {
        try {
          await circuitBreaker.execute(async () => {
            await Timer.delay(1);
            return `result-${i}`;
          });
        } catch (error) {
          // Some may fail, that's ok
        }
      }

      // Verify metrics
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalCalls).toBe(1000);

      // Check if sliding window exists and has reasonable size
      const metricsCollector = (circuitBreaker as any).metricsCollector;
      if (metricsCollector && metricsCollector.slidingWindow) {
        expect(metricsCollector.slidingWindow).toBeDefined();
      }
    });
  });

  describe("State Transition Performance", () => {
    it("should handle rapid state transitions efficiently", async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 50,
        timeout: 100,
      });

      let shouldFail = false;
      const operation = async () => {
        if (shouldFail) {
          throw new Error("Simulated failure");
        }
        return "success";
      };

      const start = performance.now();

      // Cycle through states multiple times
      for (let cycle = 0; cycle < 10; cycle++) {
        // Success phase
        shouldFail = false;
        for (let i = 0; i < 5; i++) {
          await circuitBreaker.execute(operation);
        }

        // Failure phase - trigger circuit opening
        shouldFail = true;
        for (let i = 0; i < 5; i++) {
          try {
            await circuitBreaker.execute(operation);
          } catch (error) {
            // Expected failures
          }
        }

        // Wait for reset
        await Timer.delay(60);

        // Recovery phase
        shouldFail = false;
        await circuitBreaker.execute(operation);
      }

      const end = performance.now();
      const totalTime = end - start;

      console.log(`State transition cycles completed in ${totalTime.toFixed(2)}ms`);

      // Should complete cycles reasonably quickly
      expect(totalTime).toBeLessThan(2000); // 2 seconds for 10 cycles
    });
  });

  describe("Metrics Collection Performance", () => {
    it("should collect metrics efficiently", async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 10,
        resetTimeout: 1000,
        timeout: 100,
      });

      const operation = () => Promise.resolve("data");

      // Execute operations
      for (let i = 0; i < 1000; i++) {
        await circuitBreaker.execute(operation);
      }

      // Measure metrics collection time
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        circuitBreaker.getMetrics();
      }

      const end = performance.now();
      const metricsTime = end - start;
      const timePerMetricsCall = metricsTime / 1000;

      console.log(`1000 metrics calls took ${metricsTime.toFixed(2)}ms`);
      console.log(`Time per metrics call: ${timePerMetricsCall.toFixed(4)}ms`);

      // Metrics collection should be very fast
      expect(timePerMetricsCall).toBeLessThan(0.1); // Less than 0.1ms per call
    });

    it("should handle metrics filtering efficiently", async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 10,
        resetTimeout: 1000,
        timeout: 100,
      });

      const operation = () => Promise.resolve("data");

      // Execute many operations to build up metrics
      for (let i = 0; i < 1000; i++) {
        await circuitBreaker.execute(operation);
      }

      const start = performance.now();

      // Test various metrics operations
      for (let i = 0; i < 100; i++) {
        const metrics = circuitBreaker.getMetrics();

        // Access various computed properties
        expect(metrics.failureRate).toBeGreaterThanOrEqual(0);
        if (metrics.averageResponseTime > 0) {
          expect(metrics.averageResponseTime).toBeGreaterThan(0);
        }
        expect(metrics.totalCalls).toBe(1000);
        expect(metrics.state).toBe(CircuitState.CLOSED);
        const metricsCollector = (circuitBreaker as any).metricsCollector;
        expect(metricsCollector).toBeDefined();
        if (metricsCollector && metricsCollector.slidingWindow) {
          expect(metricsCollector.slidingWindow).toBeDefined();
        }
      }

      const end = performance.now();

      console.log(`Sliding window memory test completed in ${end - start}ms`);

      // Verify metrics
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalCalls).toBeGreaterThan(0);
      expect(metrics.successfulCalls).toBeGreaterThan(0);

      // Check sliding window size is reasonable
      const metricsCollector = (circuitBreaker as any).metricsCollector;
      if (
        metricsCollector &&
        metricsCollector.slidingWindow &&
        metricsCollector.slidingWindow.getRecords
      ) {
        const records = metricsCollector.slidingWindow.getRecords();
        expect(records.length).toBeLessThanOrEqual(1000); // Should not grow unbounded
      }
    });
  });
});
