# Bulwark

> A modern, TypeScript-first circuit breaker library for Node.js applications

[![npm version](https://badge.fury.io/js/bulwark.svg)](https://badge.fury.io/js/bulwark)
[![CI](https://github.com/tanmaymadaan/bulwark/workflows/CI/badge.svg)](https://github.com/tanmaymadaan/bulwark/actions)
[![Coverage Status](https://coveralls.io/repos/github/tanmaymadaan/bulwark/badge.svg?branch=main)](https://coveralls.io/github/tanmaymadaan/bulwark?branch=main)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## 🎯 Why Bulwark?

Bulwark is designed to solve the pain points of existing circuit breaker libraries:

- **TypeScript-First**: Native TypeScript with full type safety, not bolted-on types
- **Simple API**: Promise-based, intuitive design that's easy to reason about
- **Smart Defaults**: Zero configuration needed for most use cases
- **Modern Performance**: <1ms overhead, optimized for high-throughput applications
- **Developer Experience**: Excellent documentation, clear error messages, debugging tools

## 🚀 Quick Start

### Installation

```bash
npm install bulwark
```

### Basic Usage

```typescript
import { CircuitBreaker } from "bulwark";

// Zero configuration - smart defaults
const breaker = new CircuitBreaker();

// Protect any async operation
const result = await breaker.execute(async () => {
  const response = await fetch("https://api.example.com/data");
  return response.json();
});
```

### With Configuration

```typescript
import { CircuitBreaker } from "bulwark";

const breaker = new CircuitBreaker({
  failureThreshold: 5, // Open after 5 failures
  failureRateThreshold: 0.5, // Or 50% failure rate
  timeout: 3000, // 3 second timeout
  resetTimeout: 60000, // Try again after 1 minute
});

try {
  const data = await breaker.execute(() => apiCall());
  console.log("Success:", data);
} catch (error) {
  console.error("Circuit breaker prevented call:", error.message);
}
```

## 📚 Core Concepts

### Circuit States

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Circuit is open, requests fail fast
- **HALF_OPEN**: Testing if service has recovered

### Configuration Options

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening (default: 5)
  failureRateThreshold: number; // Failure rate 0-1 before opening (default: 0.5)
  timeout: number; // Request timeout in ms (default: 3000)
  resetTimeout: number; // Time before retry in ms (default: 60000)
  minimumThroughput: number; // Min calls before rate calculation (default: 10)
}
```

## 🔧 API Reference

### CircuitBreaker Class

#### Constructor

```typescript
new CircuitBreaker(config?: Partial<CircuitBreakerConfig>)
```

#### Methods

##### `execute<T>(operation: () => Promise<T>): Promise<T>`

Executes an operation with circuit breaker protection.

```typescript
const result = await breaker.execute(async () => {
  return await fetch("/api/data").then((r) => r.json());
});
```

##### `getMetrics(): CircuitBreakerMetrics`

Returns current metrics and statistics.

```typescript
const metrics = breaker.getMetrics();
console.log(`Success rate: ${(1 - metrics.failureRate) * 100}%`);
console.log(`Current state: ${metrics.state}`);
```

##### `exportMetricsJSON(): string`

Exports current metrics as JSON string for external monitoring systems.

```typescript
const jsonMetrics = breaker.exportMetricsJSON();
console.log("Metrics for monitoring:", jsonMetrics);

// Parse the JSON for programmatic use
const parsedMetrics = JSON.parse(jsonMetrics);
console.log(`Timestamp: ${parsedMetrics.timestamp}`);
```

##### `getWindowStats(): object`

Gets sliding window statistics including window size, current count, and failure rate.

```typescript
const windowStats = breaker.getWindowStats();
console.log(`Window size: ${windowStats.windowSize}`);
console.log(`Current count: ${windowStats.currentCount}`);
console.log(`Window failure rate: ${windowStats.failureRate}`);
```

##### `reset(): void`

Resets the circuit breaker to initial state.

```typescript
breaker.reset(); // Back to CLOSED state with cleared metrics
```

##### `getConfig(): Readonly<CircuitBreakerConfig>`

Returns the current configuration used by the circuit breaker.

```typescript
const config = breaker.getConfig();
console.log(`Failure threshold: ${config.failureThreshold}`);
```

## 📊 Monitoring & Metrics

### Basic Metrics

```typescript
const metrics = breaker.getMetrics();

console.log({
  state: metrics.state, // Current circuit state
  totalCalls: metrics.totalCalls, // Total number of calls
  successfulCalls: metrics.successfulCalls, // Successful calls
  failedCalls: metrics.failedCalls, // Failed calls
  failureRate: metrics.failureRate, // Current failure rate (0-1)
  averageResponseTime: metrics.averageResponseTime, // Avg response time
  lastStateChange: metrics.lastStateChange, // When state last changed
  nextAttempt: metrics.nextAttempt, // Next retry time (if OPEN)
});
```

### JSON Export for Monitoring

Perfect for integration with monitoring systems like Prometheus, Grafana, or custom dashboards:

```typescript
// Export metrics as JSON with timestamp
const jsonMetrics = breaker.exportMetricsJSON();

// Send to monitoring system
await fetch("/metrics", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: jsonMetrics,
});
```

### Sliding Window Statistics

Get detailed statistics about the sliding window used for failure rate calculation:

```typescript
const windowStats = breaker.getWindowStats();

console.log(`
  Window Configuration:
  - Size: ${windowStats.windowSize} calls
  - Current Count: ${windowStats.currentCount} calls
  - Window Failure Rate: ${(windowStats.failureRate * 100).toFixed(1)}%
`);
```

## 🎨 Examples

### HTTP API Protection

```typescript
import { CircuitBreaker } from "bulwark";

class PaymentService {
  private breaker = new CircuitBreaker({
    failureThreshold: 3,
    timeout: 5000,
  });

  async processPayment(amount: number): Promise<PaymentResult> {
    return this.breaker.execute(async () => {
      const response = await fetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({ amount }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Payment failed: ${response.status}`);
      }

      return response.json();
    });
  }

  // Monitor payment service health
  getHealthMetrics() {
    const metrics = this.breaker.getMetrics();
    return {
      isHealthy: metrics.state === "CLOSED",
      successRate: ((metrics.successfulCalls / metrics.totalCalls) * 100).toFixed(1) + "%",
      averageResponseTime: metrics.averageResponseTime.toFixed(0) + "ms",
    };
  }
}
```

### Database Connection Protection

```typescript
import { CircuitBreaker } from "bulwark";

class DatabaseService {
  private breaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 30000, // Retry after 30 seconds
  });

  async query(sql: string): Promise<any[]> {
    return this.breaker.execute(async () => {
      const connection = await this.pool.getConnection();
      try {
        return await connection.query(sql);
      } finally {
        connection.release();
      }
    });
  }

  // Export metrics for database monitoring
  async exportDatabaseMetrics() {
    const jsonMetrics = this.breaker.exportMetricsJSON();

    // Send to monitoring system
    await this.monitoringService.send("database_circuit_breaker", jsonMetrics);

    return jsonMetrics;
  }
}
```

### With Custom Error Handling

```typescript
import { CircuitBreaker, CircuitBreakerError } from "bulwark";

const breaker = new CircuitBreaker();

try {
  const result = await breaker.execute(() => unreliableService());
} catch (error) {
  if (error instanceof CircuitBreakerError) {
    console.log(`Circuit breaker is ${error.state}`);

    // Get detailed metrics for debugging
    const metrics = breaker.getMetrics();
    console.log(`Next attempt: ${metrics.nextAttempt?.toISOString()}`);

    // Handle circuit breaker errors (fail fast)
  } else {
    console.log("Service error:", error.message);
    // Handle actual service errors
  }
}
```

### Monitoring Dashboard Integration

```typescript
import { CircuitBreaker } from "bulwark";

class MonitoringService {
  private breakers = new Map<string, CircuitBreaker>();

  registerBreaker(name: string, breaker: CircuitBreaker) {
    this.breakers.set(name, breaker);
  }

  // Collect all metrics for dashboard
  async collectAllMetrics() {
    const allMetrics = {};

    for (const [name, breaker] of this.breakers) {
      // Use JSON export for consistent format
      const jsonMetrics = breaker.exportMetricsJSON();
      allMetrics[name] = JSON.parse(jsonMetrics);

      // Add window statistics
      allMetrics[name].windowStats = breaker.getWindowStats();
    }

    return allMetrics;
  }

  // Health check endpoint
  async getHealthStatus() {
    const status = {};

    for (const [name, breaker] of this.breakers) {
      const metrics = breaker.getMetrics();
      status[name] = {
        healthy: metrics.state === "CLOSED",
        state: metrics.state,
        successRate: (1 - metrics.failureRate) * 100,
        lastStateChange: metrics.lastStateChange,
      };
    }

    return status;
  }
}
```

## 🔄 Version Roadmap

- **v0.0.1** ✅ Foundation and core structure
- **v0.0.2** ✅ Basic state machine implementation
- **v0.0.3** ✅ Metrics collection and monitoring with JSON export
- **v0.1.0** 🎯 MVP with complete functionality
- **v0.2.0** 🔌 HTTP client integrations
- **v0.3.0** 🧠 Adaptive features and smart behavior

See [PLAN-040625.md](./PLAN-040625.md) for detailed roadmap.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/tanmaymadaan/bulwark.git
cd bulwark

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run linting
npm run lint
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

Inspired by the circuit breaker pattern and existing libraries, but built from the ground up for modern TypeScript development.

---

**Built with ❤️ for the Node.js and TypeScript community**
