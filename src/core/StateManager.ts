import { CircuitState } from "../types/index";

/**
 * Manages circuit breaker state transitions with validation
 */
export class StateManager {
  private currentState: CircuitState = CircuitState.CLOSED;
  private lastStateChange: Date = new Date();

  /**
   * Gets the current circuit state
   * @returns Current circuit state
   */
  public getState(): CircuitState {
    return this.currentState;
  }

  /**
   * Gets the last state change timestamp
   * @returns Last state change timestamp
   */
  public getLastStateChange(): Date {
    return this.lastStateChange;
  }

  /**
   * Transitions to a new state with validation
   * @param {CircuitState} newState - The state to transition to
   * @returns {void}
   * @throws {Error} If the transition is invalid
   */
  public transitionTo(newState: CircuitState): void {
    if (!this.isValidTransition(this.currentState, newState)) {
      throw new Error(`Invalid state transition from ${this.currentState} to ${newState}`);
    }

    this.currentState = newState;
    this.lastStateChange = new Date();
  }

  /**
   * Resets the state manager to initial state
   * @returns {void}
   */
  public reset(): void {
    this.currentState = CircuitState.CLOSED;
    this.lastStateChange = new Date();
  }

  /**
   * Validates if a state transition is allowed
   * @param {CircuitState} from - Current state
   * @param {CircuitState} to - Target state
   * @returns {boolean} True if transition is valid
   */
  private isValidTransition(from: CircuitState, to: CircuitState): boolean {
    // Same state transitions are always valid (idempotent)
    if (from === to) {
      return true;
    }

    // Define valid transitions based on circuit breaker pattern
    const validTransitions: Record<CircuitState, CircuitState[]> = {
      [CircuitState.CLOSED]: [CircuitState.OPEN],
      [CircuitState.OPEN]: [CircuitState.HALF_OPEN],
      [CircuitState.HALF_OPEN]: [CircuitState.CLOSED, CircuitState.OPEN],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }
}
