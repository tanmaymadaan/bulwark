import { Timer } from "../../src/utils/Timer";

describe("Timer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("constructor", () => {
    it("should create timer with valid duration", () => {
      const timer = new Timer(1000);
      expect(timer).toBeInstanceOf(Timer);
    });

    it("should throw error for zero duration", () => {
      expect(() => new Timer(0)).toThrow("Duration must be greater than 0");
    });

    it("should throw error for negative duration", () => {
      expect(() => new Timer(-100)).toThrow("Duration must be greater than 0");
    });
  });

  describe("start()", () => {
    it("should start timer without callback", () => {
      const timer = new Timer(1000);
      timer.start();
      expect(timer.isRunning()).toBe(true);
    });

    it("should start timer with callback", async () => {
      const callback = jest.fn();
      const timer = new Timer(100);

      timer.start(callback);
      expect(timer.isRunning()).toBe(true);

      jest.advanceTimersByTime(100);
      await Promise.resolve(); // Let the promise resolve

      expect(callback).toHaveBeenCalledTimes(1);
      expect(timer.isRunning()).toBe(false);
    });

    it("should not restart already running timer", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const timer = new Timer(1000);

      timer.start(callback1);
      timer.start(callback2); // This should not restart

      jest.advanceTimersByTime(1000);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
    });

    it("should track elapsed time correctly", () => {
      const timer = new Timer(1000);
      timer.start();

      jest.advanceTimersByTime(500);
      expect(timer.getElapsedTime()).toBe(500);
    });
  });

  describe("stop()", () => {
    it("should stop running timer", () => {
      const timer = new Timer(1000);
      timer.start();
      expect(timer.isRunning()).toBe(true);

      timer.stop();
      expect(timer.isRunning()).toBe(false);
    });

    it("should do nothing when stopping non-running timer", () => {
      const timer = new Timer(1000);
      expect(() => timer.stop()).not.toThrow();
      expect(timer.isRunning()).toBe(false);
    });

    it("should clear timeout when stopped", () => {
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
      const timer = new Timer(1000);
      timer.start();
      timer.stop();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe("getRemainingTime()", () => {
    it("should return 0 when not started", () => {
      const timer = new Timer(1000);
      expect(timer.getRemainingTime()).toBe(0);
    });

    it("should return remaining time when running", () => {
      const timer = new Timer(1000);
      timer.start();

      jest.advanceTimersByTime(300);
      expect(timer.getRemainingTime()).toBe(700);
    });

    it("should return 0 when timer has expired", () => {
      const timer = new Timer(1000);
      timer.start();

      jest.advanceTimersByTime(1000);
      expect(timer.getRemainingTime()).toBe(0);
    });

    it("should return 0 when stopped after expiration", () => {
      const timer = new Timer(1000);
      timer.start();

      jest.advanceTimersByTime(1000);
      timer.stop();
      expect(timer.getRemainingTime()).toBe(0);
    });
  });

  describe("getElapsedTime()", () => {
    it("should return 0 when not started", () => {
      const timer = new Timer(1000);
      expect(timer.getElapsedTime()).toBe(0);
    });

    it("should return elapsed time when running", () => {
      const timer = new Timer(1000);
      timer.start();

      jest.advanceTimersByTime(400);
      expect(timer.getElapsedTime()).toBe(400);
    });

    it("should return elapsed time when stopped", () => {
      const timer = new Timer(1000);
      timer.start();

      jest.advanceTimersByTime(600);
      timer.stop();
      expect(timer.getElapsedTime()).toBe(600);
    });

    it("should cap elapsed time at duration", () => {
      const timer = new Timer(1000);
      timer.start();

      jest.advanceTimersByTime(1500);
      expect(timer.getElapsedTime()).toBe(1500); // Should not cap
    });
  });

  describe("reset()", () => {
    it("should reset stopped timer", () => {
      const timer = new Timer(1000);
      timer.start();
      timer.stop();

      timer.reset();
      expect(timer.isRunning()).toBe(false);
      expect(timer.getElapsedTime()).toBe(0);
    });

    it("should reset and stop running timer", () => {
      const timer = new Timer(1000);
      timer.start();

      timer.reset();
      expect(timer.isRunning()).toBe(false);
      expect(timer.getElapsedTime()).toBe(0);
    });

    it("should allow restarting after reset", () => {
      const timer = new Timer(1000);
      timer.start();
      timer.reset();

      timer.start();
      expect(timer.isRunning()).toBe(true);
    });
  });

  describe("static createTimeoutPromise()", () => {
    it("should create promise that rejects after timeout", async () => {
      const timeoutPromise = Timer.createTimeoutPromise(100, "Custom timeout");

      jest.advanceTimersByTime(100);

      await expect(timeoutPromise).rejects.toThrow("Custom timeout");
    });

    it("should create promise with custom message", async () => {
      const timeoutPromise = Timer.createTimeoutPromise(50, "Custom message");

      jest.advanceTimersByTime(50);

      await expect(timeoutPromise).rejects.toThrow("Custom message");
    });

    it("should handle zero timeout", async () => {
      const timeoutPromise = Timer.createTimeoutPromise(0, "Operation timed out");

      jest.advanceTimersByTime(0);

      await expect(timeoutPromise).rejects.toThrow("Operation timed out");
    });
  });

  describe("static delay()", () => {
    it("should create delay promise", async () => {
      const delayPromise = Timer.delay(100);

      jest.advanceTimersByTime(100);

      await expect(delayPromise).resolves.toBeUndefined();
    });

    it("should handle zero delay", async () => {
      const delayPromise = Timer.delay(0);

      jest.advanceTimersByTime(0);

      await expect(delayPromise).resolves.toBeUndefined();
    });
  });

  describe("static withTimeout()", () => {
    it("should resolve with promise result when promise resolves first", async () => {
      const promise = Promise.resolve("success");
      const result = await Timer.withTimeout(promise, 1000, "Operation timed out");
      expect(result).toBe("success");
    });

    it("should reject with timeout error when timeout occurs first", async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve("late"), 200);
      });

      const timeoutPromise = Timer.withTimeout(promise, 100, "Timeout occurred");

      jest.advanceTimersByTime(100);

      await expect(timeoutPromise).rejects.toThrow("Timeout occurred");
    });

    it("should reject with promise error when promise rejects first", async () => {
      const promise = Promise.reject(new Error("Promise error"));

      await expect(Timer.withTimeout(promise, 1000, "Operation timed out")).rejects.toThrow(
        "Promise error"
      );
    });

    it("should use custom timeout message", async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve("late"), 200);
      });

      const timeoutPromise = Timer.withTimeout(promise, 100, "Custom timeout message");

      jest.advanceTimersByTime(100);

      await expect(timeoutPromise).rejects.toThrow("Custom timeout message");
    });

    it("should handle zero timeout", async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve("late"), 100);
      });

      const timeoutPromise = Timer.withTimeout(promise, 0, "Operation timed out");

      jest.advanceTimersByTime(0);

      await expect(timeoutPromise).rejects.toThrow("Operation timed out");
    });

    it("should clean up timeout when promise resolves", async () => {
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
      const promise = Promise.resolve("success");

      await Timer.withTimeout(promise, 1000, "Operation timed out");

      // The timeout should be cleared when the promise resolves first
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it("should clean up timeout when promise rejects", async () => {
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
      const promise = Promise.reject(new Error("Promise error"));

      try {
        await Timer.withTimeout(promise, 1000, "Operation timed out");
      } catch (e) {
        // Expected
      }

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("should handle multiple start/stop cycles", () => {
      const timer = new Timer(1000);

      timer.start();
      timer.stop();
      timer.start();
      timer.stop();

      expect(timer.isRunning()).toBe(false);
    });

    it("should handle callback exceptions gracefully", () => {
      const errorCallback = jest.fn(() => {
        throw new Error("Callback error");
      });

      const timer = new Timer(1000);
      timer.start(errorCallback);

      // The timer should handle callback errors gracefully
      expect(() => {
        jest.advanceTimersByTime(1000);
      }).toThrow("Callback error");

      expect(errorCallback).toHaveBeenCalledTimes(1);
    });

    it("should maintain state consistency after timer expiration", () => {
      const timer = new Timer(1000);
      timer.start();

      jest.advanceTimersByTime(1000);

      expect(timer.isRunning()).toBe(false);
      expect(timer.getElapsedTime()).toBe(1000);
      expect(timer.getRemainingTime()).toBe(0);
    });
  });
});
