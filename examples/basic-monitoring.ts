import { CircuitBreaker } from "../src/core/CircuitBreaker";

/**
 * Basic monitoring example showing v0.0.3 export features
 *
 * This example demonstrates:
 * - Basic circuit breaker usage
 * - Metrics collection and export
 * - Simple JSON monitoring setup
 * - Window statistics access
 */

async function main() {
  console.log("🔧 Bulwark v0.0.3 - Basic Monitoring Example");
  console.log("===========================================\n");

  // Create a circuit breaker with monitoring-friendly settings
  const breaker = new CircuitBreaker({
    failureThreshold: 3,
    timeout: 2000,
    resetTimeout: 5000,
  });

  // Simulate some API calls for demonstration
  console.log("📊 Simulating API calls...");

  const mockApiCall = async (shouldFail = false): Promise<string> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100 + 50));

    if (shouldFail) {
      throw new Error("API service unavailable");
    }

    return "API response data";
  };

  // Execute successful operations
  for (let i = 0; i < 5; i++) {
    try {
      const result = await breaker.execute(() => mockApiCall(false));
      console.log(`✅ Call ${i + 1}: ${result}`);
    } catch (error) {
      console.log(`❌ Call ${i + 1}: ${error.message}`);
    }
  }

  // Display basic metrics
  console.log("\n📈 Basic Metrics:");
  const metrics = breaker.getMetrics();
  console.log(`State: ${metrics.state}`);
  console.log(`Total Calls: ${metrics.totalCalls}`);
  console.log(
    `Success Rate: ${((metrics.successfulCalls / metrics.totalCalls) * 100).toFixed(1)}%`
  );
  console.log(`Average Response Time: ${metrics.averageResponseTime.toFixed(1)}ms`);

  // Show window statistics
  console.log("\n🪟 Sliding Window Stats:");
  const windowStats = breaker.getWindowStats();
  console.log(`Window Size: ${windowStats.windowSize}`);
  console.log(`Current Count: ${windowStats.currentCount}`);
  console.log(`Window Failure Rate: ${(windowStats.failureRate * 100).toFixed(1)}%`);

  // Simulate some failures
  console.log("\n⚠️  Simulating failures...");
  for (let i = 0; i < 4; i++) {
    try {
      await breaker.execute(() => mockApiCall(true));
    } catch (error) {
      console.log(`❌ Failure ${i + 1}: ${error.message}`);
    }
  }

  // Export metrics as JSON (for external monitoring)
  console.log("\n📤 JSON Export (for monitoring systems):");
  const jsonMetrics = breaker.exportMetricsJSON();
  console.log(jsonMetrics);

  // Show how metrics change over time
  console.log("\n🔄 Updated metrics after failures:");
  const updatedMetrics = breaker.getMetrics();
  console.log(`State: ${updatedMetrics.state}`);
  console.log(`Total Calls: ${updatedMetrics.totalCalls}`);
  console.log(`Failure Rate: ${(updatedMetrics.failureRate * 100).toFixed(1)}%`);

  // Demonstrate monitoring loop (simple example)
  console.log("\n🔄 Monitoring Loop Example (5 iterations):");
  for (let i = 0; i < 5; i++) {
    // Try to execute an operation
    try {
      await breaker.execute(() => mockApiCall(Math.random() > 0.7));
    } catch (error) {
      // Handle failure (circuit may be open)
    }

    // Quick metrics snapshot
    const snapshot = breaker.getMetrics();
    const windowSnapshot = breaker.getWindowStats();

    console.log(
      `Iteration ${i + 1}: State=${snapshot.state}, Total=${snapshot.totalCalls}, Window=${windowSnapshot.currentCount}`
    );

    // Wait a bit between iterations
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n✅ Basic monitoring example completed!");
  console.log("\n💡 Key v0.0.3 features demonstrated:");
  console.log("   - exportMetricsJSON(): Get metrics as JSON string");
  console.log("   - getWindowStats(): Access sliding window statistics");
  console.log("   - Performance: <1ms overhead per operation");
  console.log("   - Memory stability: Bounded sliding window");
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main as basicMonitoringExample };
