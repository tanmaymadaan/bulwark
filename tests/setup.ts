/**
 * Global test setup for Bulwark Circuit Breaker Library
 */

// Global test timeout
jest.setTimeout(10000);

// Mock console methods in tests to avoid noise
const originalConsole = global.console;

beforeEach(() => {
  // Reset console mocks before each test
  global.console = {
    ...originalConsole,
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };
});

afterEach(() => {
  // Restore original console after each test
  global.console = originalConsole;

  // Clear all mocks
  jest.clearAllMocks();
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Custom Jest matcher for performance testing
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Performance testing utilities
export const measurePerformance = async <T>(
  operation: () => Promise<T>,
  iterations: number = 1000
): Promise<{ result: T; averageTime: number; totalTime: number }> => {
  const start = process.hrtime.bigint();
  let result: T;

  for (let i = 0; i < iterations; i++) {
    result = await operation();
  }

  const end = process.hrtime.bigint();
  const totalTime = Number(end - start) / 1_000_000; // Convert to milliseconds
  const averageTime = totalTime / iterations;

  return {
    result: result!,
    averageTime,
    totalTime,
  };
};

// Test data factories
export const createMockOperation = <T>(
  result: T,
  delay: number = 0,
  shouldFail: boolean = false
) => {
  return async (): Promise<T> => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (shouldFail) {
      throw new Error("Mock operation failed");
    }

    return result;
  };
};
