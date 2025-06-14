import { StateManager } from "../../src/core/StateManager";
import { CircuitState } from "../../src/types/index";

describe("StateManager", () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe("Constructor", () => {
    it("should initialize with CLOSED state", () => {
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);
      expect(stateManager.getLastStateChange()).toBeInstanceOf(Date);
    });

    it("should set initial timestamp", () => {
      const before = new Date();
      const manager = new StateManager();
      const after = new Date();

      const timestamp = manager.getLastStateChange();
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("getState", () => {
    it("should return current state", () => {
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);
    });

    it("should return updated state after transition", () => {
      stateManager.transitionTo(CircuitState.OPEN);
      expect(stateManager.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe("getLastStateChange", () => {
    it("should return timestamp of last state change", () => {
      const initialTime = stateManager.getLastStateChange();
      expect(initialTime).toBeInstanceOf(Date);

      // Wait a bit and transition
      setTimeout(() => {
        stateManager.transitionTo(CircuitState.OPEN);
        const newTime = stateManager.getLastStateChange();
        expect(newTime.getTime()).toBeGreaterThan(initialTime.getTime());
      }, 10);
    });

    it("should update timestamp on each transition", () => {
      const time1 = stateManager.getLastStateChange();

      stateManager.transitionTo(CircuitState.OPEN);
      const time2 = stateManager.getLastStateChange();
      expect(time2.getTime()).toBeGreaterThanOrEqual(time1.getTime());

      stateManager.transitionTo(CircuitState.HALF_OPEN);
      const time3 = stateManager.getLastStateChange();
      expect(time3.getTime()).toBeGreaterThanOrEqual(time2.getTime());
    });
  });

  describe("State transitions", () => {
    it("should transition from CLOSED to OPEN", () => {
      stateManager.transitionTo(CircuitState.OPEN);
      expect(stateManager.getState()).toBe(CircuitState.OPEN);
    });

    it("should transition from OPEN to HALF_OPEN", () => {
      stateManager.transitionTo(CircuitState.OPEN);
      stateManager.transitionTo(CircuitState.HALF_OPEN);
      expect(stateManager.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it("should transition from HALF_OPEN to CLOSED", () => {
      stateManager.transitionTo(CircuitState.OPEN);
      stateManager.transitionTo(CircuitState.HALF_OPEN);
      stateManager.transitionTo(CircuitState.CLOSED);
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);
    });

    it("should transition from HALF_OPEN to OPEN", () => {
      stateManager.transitionTo(CircuitState.OPEN);
      stateManager.transitionTo(CircuitState.HALF_OPEN);
      stateManager.transitionTo(CircuitState.OPEN);
      expect(stateManager.getState()).toBe(CircuitState.OPEN);
    });

    it("should allow same state transitions (idempotent)", () => {
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);
      stateManager.transitionTo(CircuitState.CLOSED);
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);

      stateManager.transitionTo(CircuitState.OPEN);
      stateManager.transitionTo(CircuitState.OPEN);
      expect(stateManager.getState()).toBe(CircuitState.OPEN);
    });

    it("should update timestamp on state change", () => {
      const initialTime = stateManager.getLastStateChange();

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        stateManager.transitionTo(CircuitState.OPEN);
        const newTime = stateManager.getLastStateChange();
        expect(newTime.getTime()).toBeGreaterThan(initialTime.getTime());
      }, 10);
    });
  });

  describe("Validation", () => {
    it("should reject invalid transitions", () => {
      // CLOSED can only go to OPEN
      expect(() => stateManager.transitionTo(CircuitState.HALF_OPEN)).toThrow(
        "Invalid state transition from CLOSED to HALF_OPEN"
      );

      // OPEN can only go to HALF_OPEN
      stateManager.transitionTo(CircuitState.OPEN);
      expect(() => stateManager.transitionTo(CircuitState.CLOSED)).toThrow(
        "Invalid state transition from OPEN to CLOSED"
      );
    });

    it("should handle all valid state transitions", () => {
      // Test complete valid flow
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);

      // CLOSED -> OPEN
      stateManager.transitionTo(CircuitState.OPEN);
      expect(stateManager.getState()).toBe(CircuitState.OPEN);

      // OPEN -> HALF_OPEN
      stateManager.transitionTo(CircuitState.HALF_OPEN);
      expect(stateManager.getState()).toBe(CircuitState.HALF_OPEN);

      // HALF_OPEN -> CLOSED
      stateManager.transitionTo(CircuitState.CLOSED);
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);

      // Test alternative path: HALF_OPEN -> OPEN
      stateManager.transitionTo(CircuitState.OPEN);
      stateManager.transitionTo(CircuitState.HALF_OPEN);
      stateManager.transitionTo(CircuitState.OPEN);
      expect(stateManager.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe("reset", () => {
    it("should reset to CLOSED state", () => {
      // Change state first
      stateManager.transitionTo(CircuitState.OPEN);
      stateManager.transitionTo(CircuitState.HALF_OPEN);
      expect(stateManager.getState()).toBe(CircuitState.HALF_OPEN);

      // Reset
      stateManager.reset();
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);
    });

    it("should update timestamp on reset", () => {
      const initialTime = stateManager.getLastStateChange();

      setTimeout(() => {
        stateManager.reset();
        const resetTime = stateManager.getLastStateChange();
        expect(resetTime.getTime()).toBeGreaterThanOrEqual(initialTime.getTime());
      }, 1);
    });

    it("should allow transitions after reset", () => {
      // Change state, reset, then transition again
      stateManager.transitionTo(CircuitState.OPEN);
      stateManager.reset();

      expect(stateManager.getState()).toBe(CircuitState.CLOSED);

      // Should be able to transition normally after reset
      stateManager.transitionTo(CircuitState.OPEN);
      expect(stateManager.getState()).toBe(CircuitState.OPEN);
    });

    it("should work when already in CLOSED state", () => {
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);

      const beforeReset = stateManager.getLastStateChange();
      stateManager.reset();

      expect(stateManager.getState()).toBe(CircuitState.CLOSED);
      expect(stateManager.getLastStateChange().getTime()).toBeGreaterThanOrEqual(
        beforeReset.getTime()
      );
    });
  });

  describe("State transition validation", () => {
    it("should validate all possible state combinations", () => {
      const states = [CircuitState.CLOSED, CircuitState.OPEN, CircuitState.HALF_OPEN];

      // Test all combinations
      for (const fromState of states) {
        for (const toState of states) {
          const manager = new StateManager();

          // Set up initial state
          if (fromState !== CircuitState.CLOSED) {
            if (fromState === CircuitState.OPEN) {
              manager.transitionTo(CircuitState.OPEN);
            } else if (fromState === CircuitState.HALF_OPEN) {
              manager.transitionTo(CircuitState.OPEN);
              manager.transitionTo(CircuitState.HALF_OPEN);
            }
          }

          expect(manager.getState()).toBe(fromState);

          // Test transition
          const isValidTransition = isValidStateTransition(fromState, toState);

          if (isValidTransition) {
            expect(() => manager.transitionTo(toState)).not.toThrow();
            expect(manager.getState()).toBe(toState);
          } else {
            expect(() => manager.transitionTo(toState)).toThrow();
            expect(manager.getState()).toBe(fromState);
          }
        }
      }
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete circuit breaker lifecycle", () => {
      // Start CLOSED
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);

      // Failures cause OPEN
      stateManager.transitionTo(CircuitState.OPEN);
      expect(stateManager.getState()).toBe(CircuitState.OPEN);

      // Timeout allows HALF_OPEN
      stateManager.transitionTo(CircuitState.HALF_OPEN);
      expect(stateManager.getState()).toBe(CircuitState.HALF_OPEN);

      // Success closes circuit
      stateManager.transitionTo(CircuitState.CLOSED);
      expect(stateManager.getState()).toBe(CircuitState.CLOSED);
    });

    it("should handle failure in HALF_OPEN state", () => {
      // Get to HALF_OPEN
      stateManager.transitionTo(CircuitState.OPEN);
      stateManager.transitionTo(CircuitState.HALF_OPEN);
      expect(stateManager.getState()).toBe(CircuitState.HALF_OPEN);

      // Failure should go back to OPEN
      stateManager.transitionTo(CircuitState.OPEN);
      expect(stateManager.getState()).toBe(CircuitState.OPEN);
    });

    it("should maintain state consistency across multiple operations", () => {
      const operations = [
        CircuitState.OPEN,
        CircuitState.HALF_OPEN,
        CircuitState.OPEN,
        CircuitState.HALF_OPEN,
        CircuitState.CLOSED,
        CircuitState.OPEN,
      ];

      for (const targetState of operations) {
        stateManager.transitionTo(targetState);
        expect(stateManager.getState()).toBe(targetState);
        expect(stateManager.getLastStateChange()).toBeInstanceOf(Date);
      }
    });
  });
});

// Helper function to determine if a state transition is valid
function isValidStateTransition(from: CircuitState, to: CircuitState): boolean {
  if (from === to) return true;

  const validTransitions: Record<CircuitState, CircuitState[]> = {
    [CircuitState.CLOSED]: [CircuitState.OPEN],
    [CircuitState.OPEN]: [CircuitState.HALF_OPEN],
    [CircuitState.HALF_OPEN]: [CircuitState.CLOSED, CircuitState.OPEN],
  };

  return validTransitions[from]?.includes(to) ?? false;
}
