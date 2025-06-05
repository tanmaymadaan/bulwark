/**
 * Basic Circuit Breaker Usage Examples
 *
 * This file demonstrates the fundamental usage patterns of the Bulwark circuit breaker.
 * These examples show the planned API for v0.1.0 when full functionality is implemented.
 */

import { CircuitBreaker, CircuitBreakerError, CircuitState } from "../src/index";

// Example 1: Zero Configuration (Smart Defaults)
async function basicUsage(): Promise<void> {
  console.log("=== Basic Usage Example ===");

  // Create circuit breaker with smart defaults
  const breaker = new CircuitBreaker();

  try {
    const result = await breaker.execute(async () => {
      // Simulate API call
      const response = await fetch("https://api.example.com/data");
      return response.json();
    });

    console.log("Success:", result);
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      console.log(`Circuit breaker is ${error.state}`);
    } else {
      console.log("Service error:", error.message);
    }
  }
}

// Example 2: Custom Configuration
async function customConfiguration(): Promise<void> {
  console.log("=== Custom Configuration Example ===");

  const breaker = new CircuitBreaker({
    failureThreshold: 3, // Open after 3 failures
    failureRateThreshold: 0.6, // Or 60% failure rate
    timeout: 5000, // 5 second timeout
    resetTimeout: 30000, // Try again after 30 seconds
    minimumThroughput: 5, // Need 5 calls before calculating rate
  });

  try {
    const result = await breaker.execute(async () => {
      // Simulate payment processing
      return await processPayment({ amount: 100, currency: "USD" });
    });

    console.log("Payment processed:", result);
  } catch (error) {
    console.error("Payment failed:", error.message);
  }
}

// Example 3: Monitoring and Metrics
async function monitoringExample(): Promise<void> {
  console.log("=== Monitoring Example ===");

  const breaker = new CircuitBreaker({
    failureThreshold: 2,
    resetTimeout: 10000,
  });

  // Simulate multiple calls to show metrics
  for (let i = 0; i < 5; i++) {
    try {
      await breaker.execute(async () => {
        // Simulate unreliable service (50% failure rate)
        if (Math.random() < 0.5) {
          throw new Error("Service temporarily unavailable");
        }
        return `Success ${i}`;
      });
    } catch (error) {
      // Handle errors
    }

    // Check metrics after each call
    const metrics = breaker.getMetrics();
    console.log(`Call ${i + 1}:`, {
      state: metrics.state,
      totalCalls: metrics.totalCalls,
      successRate: `${((1 - metrics.failureRate) * 100).toFixed(1)}%`,
      failedCalls: metrics.failedCalls,
    });
  }
}

// Example 4: Error Handling Patterns
async function errorHandlingExample(): Promise<void> {
  console.log("=== Error Handling Example ===");

  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    resetTimeout: 5000,
  });

  try {
    const result = await breaker.execute(async () => {
      throw new Error("Service is down");
    });
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      // Circuit breaker prevented the call
      console.log("Circuit breaker error:", {
        message: error.message,
        state: error.state,
        nextAttempt: breaker.getMetrics().nextAttempt,
      });
    } else {
      // Actual service error
      console.log("Service error:", error.message);
    }
  }
}

// Example 5: State Management
async function stateManagementExample(): Promise<void> {
  console.log("=== State Management Example ===");

  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    resetTimeout: 2000,
  });

  console.log("Initial state:", breaker.getState()); // CLOSED

  try {
    // This will fail and open the circuit
    await breaker.execute(async () => {
      throw new Error("Failure");
    });
  } catch (error) {
    console.log("After failure, state:", breaker.getState()); // OPEN
  }

  // Manual reset
  breaker.reset();
  console.log("After reset, state:", breaker.getState()); // CLOSED
}

// Helper function for examples
async function processPayment(payment: { amount: number; currency: string }): Promise<any> {
  // Simulate payment processing
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (Math.random() < 0.1) {
    throw new Error("Payment gateway timeout");
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    status: "completed",
    amount: payment.amount,
    currency: payment.currency,
  };
}

// Run examples (commented out since execute() is not implemented in v0.0.1)
async function runExamples(): Promise<void> {
  console.log("Bulwark Circuit Breaker Examples");
  console.log("================================");
  console.log("Note: These examples show the planned API for v0.1.0");
  console.log('Current v0.0.1 has the structure but execute() throws "Not implemented"');
  console.log("");

  // Uncomment when execute() is implemented in v0.0.2+
  // await basicUsage();
  // await customConfiguration();
  // await monitoringExample();
  // await errorHandlingExample();
  // await stateManagementExample();
}

// Export for use in other files
export {
  basicUsage,
  customConfiguration,
  monitoringExample,
  errorHandlingExample,
  stateManagementExample,
  runExamples,
};

// Run if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}
