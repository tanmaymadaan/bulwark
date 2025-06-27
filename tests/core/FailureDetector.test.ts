import { FailureDetector } from "../../src/core/FailureDetector";
import { CircuitBreakerConfig, DEFAULT_CONFIG } from "../../src/types/index";

describe("FailureDetector", () => {
  let failureDetector: FailureDetector;
  let config: CircuitBreakerConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };
    failureDetector = new FailureDetector(config);
  });

  describe("Constructor", () => {
    it("should create instance with default configuration", () => {
      expect(failureDetector).toBeInstanceOf(FailureDetector);
      expect(failureDetector.getConsecutiveFailures()).toBe(0);
      expect(failureDetector.getCallCount()).toBe(0);
      expect(failureDetector.getFailureRate()).toBe(0);
    });

    it("should create instance with custom configuration", () => {
      const customConfig = {
        ...DEFAULT_CONFIG,
        failureThreshold: 3,
        minimumThroughput: 5,
      };
      const detector = new FailureDetector(customConfig);
      expect(detector.getConsecutiveFailures()).toBe(0);
    });
  });

  describe("recordSuccess", () => {
    it("should record success without error", () => {
      failureDetector.recordSuccess();

      expect(failureDetector.getConsecutiveFailures()).toBe(0);
      expect(failureDetector.getCallCount()).toBe(1);
      expect(failureDetector.getFailureRate()).toBe(0);
    });

    it("should record success with error parameter", () => {
      const error = new Error("Test error");
      failureDetector.recordSuccess(error);

      expect(failureDetector.getConsecutiveFailures()).toBe(0);
      expect(failureDetector.getCallCount()).toBe(1);
      expect(failureDetector.getFailureRate()).toBe(0);
    });

    it("should reset consecutive failures after recording success", () => {
      // Record some failures first
      failureDetector.recordFailure(new Error("Failure 1"));
      failureDetector.recordFailure(new Error("Failure 2"));
      expect(failureDetector.getConsecutiveFailures()).toBe(2);

      // Record success should reset consecutive failures
      failureDetector.recordSuccess();
      expect(failureDetector.getConsecutiveFailures()).toBe(0);
    });
  });

  describe("recordFailure", () => {
    it("should record failure and increment consecutive failures", () => {
      const error = new Error("Test failure");
      failureDetector.recordFailure(error);

      expect(failureDetector.getConsecutiveFailures()).toBe(1);
      expect(failureDetector.getCallCount()).toBe(1);
      expect(failureDetector.getFailureRate()).toBe(1);
    });

    it("should increment consecutive failures for multiple failures", () => {
      failureDetector.recordFailure(new Error("Failure 1"));
      failureDetector.recordFailure(new Error("Failure 2"));
      failureDetector.recordFailure(new Error("Failure 3"));

      expect(failureDetector.getConsecutiveFailures()).toBe(3);
      expect(failureDetector.getCallCount()).toBe(3);
      expect(failureDetector.getFailureRate()).toBe(1);
    });
  });

  describe("getFailureRate", () => {
    it("should return 0 when no calls recorded", () => {
      expect(failureDetector.getFailureRate()).toBe(0);
    });

    it("should calculate correct failure rate with mixed calls", () => {
      // Record 3 failures and 2 successes
      failureDetector.recordFailure(new Error("Failure 1"));
      failureDetector.recordFailure(new Error("Failure 2"));
      failureDetector.recordFailure(new Error("Failure 3"));
      failureDetector.recordSuccess();
      failureDetector.recordSuccess();

      expect(failureDetector.getFailureRate()).toBe(0.6); // 3/5
    });

    it("should return 1 when all calls are failures", () => {
      failureDetector.recordFailure(new Error("Failure 1"));
      failureDetector.recordFailure(new Error("Failure 2"));

      expect(failureDetector.getFailureRate()).toBe(1);
    });

    it("should return 0 when all calls are successes", () => {
      failureDetector.recordSuccess();
      failureDetector.recordSuccess();
      failureDetector.recordSuccess();

      expect(failureDetector.getFailureRate()).toBe(0);
    });
  });

  describe("getCallCount", () => {
    it("should return 0 initially", () => {
      expect(failureDetector.getCallCount()).toBe(0);
    });

    it("should count all calls (successes and failures)", () => {
      failureDetector.recordSuccess();
      failureDetector.recordFailure(new Error("Failure"));
      failureDetector.recordSuccess();

      expect(failureDetector.getCallCount()).toBe(3);
    });
  });

  describe("shouldOpenCircuit", () => {
    it("should return false when insufficient data points", () => {
      // Default minimumThroughput is 10, record only 5 calls
      for (let i = 0; i < 5; i++) {
        failureDetector.recordFailure(new Error(`Failure ${i}`));
      }

      expect(failureDetector.shouldOpenCircuit()).toBe(false);
    });

    it("should return true when failure threshold exceeded", () => {
      // Record enough calls to meet minimum throughput
      for (let i = 0; i < config.minimumThroughput; i++) {
        if (i < config.failureThreshold) {
          failureDetector.recordFailure(new Error(`Failure ${i}`));
        } else {
          failureDetector.recordSuccess();
        }
      }

      expect(failureDetector.shouldOpenCircuit()).toBe(true);
    });

    it("should return true when failure rate threshold exceeded", () => {
      const totalCalls = config.minimumThroughput;
      const failureCalls = Math.ceil(totalCalls * (config.failureRateThreshold + 0.1));

      // Record failures exceeding the rate threshold
      for (let i = 0; i < failureCalls; i++) {
        failureDetector.recordFailure(new Error(`Failure ${i}`));
      }

      // Fill remaining with successes
      for (let i = failureCalls; i < totalCalls; i++) {
        failureDetector.recordSuccess();
      }

      expect(failureDetector.shouldOpenCircuit()).toBe(true);
    });

    it("should return false when thresholds not exceeded", () => {
      const totalCalls = config.minimumThroughput;
      const failureCalls = Math.floor(totalCalls * (config.failureRateThreshold - 0.1));

      // Record failures below the rate threshold
      for (let i = 0; i < failureCalls; i++) {
        failureDetector.recordFailure(new Error(`Failure ${i}`));
      }

      // Fill remaining with successes
      for (let i = failureCalls; i < totalCalls; i++) {
        failureDetector.recordSuccess();
      }

      expect(failureDetector.shouldOpenCircuit()).toBe(false);
    });

    it("should handle edge case with exactly minimum throughput", () => {
      // Record exactly minimum throughput calls, all failures
      for (let i = 0; i < config.minimumThroughput; i++) {
        failureDetector.recordFailure(new Error(`Failure ${i}`));
      }

      expect(failureDetector.shouldOpenCircuit()).toBe(true);
    });
  });

  describe("reset", () => {
    it("should reset all counters and sliding window", () => {
      const failureDetector = new FailureDetector(DEFAULT_CONFIG);

      // Record some failures and a success
      failureDetector.recordFailure(new Error("test1"));
      failureDetector.recordFailure(new Error("test2"));
      failureDetector.recordSuccess();

      // After success, consecutive failures should be reset to 0
      expect(failureDetector.getConsecutiveFailures()).toBe(0);
      expect(failureDetector.getCallCount()).toBe(3);

      // Reset
      failureDetector.reset();

      expect(failureDetector.getConsecutiveFailures()).toBe(0);
      expect(failureDetector.getCallCount()).toBe(0);
      expect(failureDetector.getFailureRate()).toBe(0);
    });

    it("should allow recording new data after reset", () => {
      const failureDetector = new FailureDetector(DEFAULT_CONFIG);

      // Record some data, reset, then record again
      failureDetector.recordFailure(new Error("test"));
      failureDetector.reset();
      failureDetector.recordSuccess();

      expect(failureDetector.getCallCount()).toBe(1);
      expect(failureDetector.getFailureRate()).toBe(0);
      expect(failureDetector.getConsecutiveFailures()).toBe(0);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle sliding window overflow", () => {
      const config = {
        ...DEFAULT_CONFIG,
        minimumThroughput: 5,
      };
      const failureDetector = new FailureDetector(config);

      // Fill window with successes (window size is minimumThroughput * 2 = 10)
      for (let i = 0; i < 10; i++) {
        failureDetector.recordSuccess();
      }

      expect(failureDetector.getFailureRate()).toBe(0);
      expect(failureDetector.getCallCount()).toBe(10);

      // Add failures that will push out successes
      for (let i = 0; i < 10; i++) {
        failureDetector.recordFailure(new Error(`fail-${i}`));
      }

      expect(failureDetector.getFailureRate()).toBe(1);
      expect(failureDetector.getCallCount()).toBe(10); // Window size limit
    });

    it("should maintain accurate failure rate during window sliding", () => {
      const config = {
        ...DEFAULT_CONFIG,
        minimumThroughput: 5,
      };
      const failureDetector = new FailureDetector(config);

      // Fill window with mixed results (window size = 10)
      // Add 5 successes, then 5 failures
      for (let i = 0; i < 5; i++) {
        failureDetector.recordSuccess();
      }
      for (let i = 0; i < 5; i++) {
        failureDetector.recordFailure(new Error(`fail-${i}`));
      }

      expect(failureDetector.getFailureRate()).toBe(0.5); // 5 failures out of 10

      // Add 5 more failures (should push out the 5 successes)
      for (let i = 0; i < 5; i++) {
        failureDetector.recordFailure(new Error(`fail-${i + 5}`));
      }

      expect(failureDetector.getFailureRate()).toBe(1); // All 10 records are now failures
    });
  });
});
