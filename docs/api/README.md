# Bulwark API Documentation

Complete API reference for the Bulwark circuit breaker library.

## 📚 Table of Contents

- [Core Classes](#core-classes)
  - [CircuitBreaker](#circuitbreaker)
- [Types & Interfaces](#types--interfaces)
  - [CircuitBreakerConfig](#circuitbreakerconfig)
  - [CircuitBreakerMetrics](#circuitbreakermetrics)
  - [CircuitState](#circuitstate)
- [Errors](#errors)
  - [CircuitBreakerError](#circuitbreakererror)
- [Constants](#constants)
  - [DEFAULT_CONFIG](#default_config)

---

## Core Classes

### CircuitBreaker

The main circuit breaker class that provides fault tolerance for operations.

#### Constructor

```typescript
new CircuitBreaker<T = any>(config?: Partial<CircuitBreakerConfig>)
```

**Type Parameters:**

- `T` - The return type of the operation being protected

**Parameters:**

- `config` (optional) - Configuration options for the circuit breaker

**Example:**

```typescript
// Default configuration
const breaker = new CircuitBreaker();

// Custom configuration
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  timeout: 3000,
  resetTimeout: 60000,
});

// With type parameter
const breaker = new CircuitBreaker<string>({
  failureThreshold: 3,
});
```

#### Methods

##### `execute<R>(operation: () => Promise<R>): Promise<R>`

Executes an operation through the circuit breaker.

**Type Parameters:**

- `R` - The return type of the operation

**Parameters:**

- `operation` - An async function to execute

**Returns:**

- `Promise<R>` - The result of the operation

**Throws:**

- `CircuitBreakerError` - When the circuit is open or half-open and fails
- Any error thrown by the operation itself

**Example:**

```typescript
try {
  const result = await breaker.execute(async () => {
    const response = await fetch("/api/data");
    return response.json();
  });
  console.log("Success:", result);
} catch (error) {
  if (error instanceof CircuitBreakerError) {
    console.log("Circuit breaker prevented call:", error.message);
  } else {
    console.log("Operation failed:", error.message);
  }
}
```

**Note:** In v0.0.1, this method throws "Not implemented" error. Full functionality available in v0.1.0.

##### `getState(): CircuitState`

Gets the current state of the circuit breaker.

**Returns:**

- `CircuitState` - Current state (CLOSED, OPEN, or HALF_OPEN)

**Example:**

```typescript
const state = breaker.getState();
console.log("Current state:", state); // "CLOSED", "OPEN", or "HALF_OPEN"
```

##### `getMetrics(): CircuitBreakerMetrics`

Gets current metrics and statistics for the circuit breaker.

**Returns:**

- `CircuitBreakerMetrics` - Current metrics object

**Example:**

```typescript
const metrics = breaker.getMetrics();
console.log("Total calls:", metrics.totalCalls);
console.log("Failed calls:", metrics.failedCalls);
console.log("Success rate:", (1 - metrics.failureRate) * 100 + "%");
```

##### `open(): void`

Manually opens the circuit breaker.

**Example:**

```typescript
breaker.open();
console.log("Circuit manually opened");
```

##### `reset(): void`

Manually resets the circuit breaker to CLOSED state.

**Example:**

```typescript
breaker.reset();
console.log("Circuit reset to CLOSED state");
```

---

## Types & Interfaces

### CircuitBreakerConfig

Configuration options for the circuit breaker.

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringPeriod: number;
}
```

**Properties:**

| Property           | Type     | Default | Description                                              |
| ------------------ | -------- | ------- | -------------------------------------------------------- |
| `failureThreshold` | `number` | `5`     | Number of failures before opening the circuit            |
| `timeout`          | `number` | `5000`  | Timeout for operations in milliseconds                   |
| `resetTimeout`     | `number` | `60000` | Time to wait before attempting to close the circuit (ms) |
| `monitoringPeriod` | `number` | `10000` | Period for monitoring and metrics collection (ms)        |

**Example:**

```typescript
const config: CircuitBreakerConfig = {
  failureThreshold: 3,
  timeout: 2000,
  resetTimeout: 30000,
  monitoringPeriod: 5000,
};
```

### CircuitBreakerMetrics

Metrics and statistics for circuit breaker performance.

```typescript
interface CircuitBreakerMetrics {
  totalCalls: number;
  failedCalls: number;
  successfulCalls: number;
  failureRate: number;
  averageResponseTime: number;
  state: CircuitState;
  lastFailureTime?: Date;
  nextAttempt?: Date;
}
```

**Properties:**

| Property              | Type              | Description                                            |
| --------------------- | ----------------- | ------------------------------------------------------ |
| `totalCalls`          | `number`          | Total number of calls made through the circuit breaker |
| `failedCalls`         | `number`          | Number of failed calls                                 |
| `successfulCalls`     | `number`          | Number of successful calls                             |
| `failureRate`         | `number`          | Failure rate as a decimal (0.0 to 1.0)                 |
| `averageResponseTime` | `number`          | Average response time in milliseconds                  |
| `state`               | `CircuitState`    | Current state of the circuit breaker                   |
| `lastFailureTime`     | `Date` (optional) | Timestamp of the last failure                          |
| `nextAttempt`         | `Date` (optional) | Timestamp when next attempt will be allowed            |

**Example:**

```typescript
const metrics = breaker.getMetrics();
console.log(`
  Total Calls: ${metrics.totalCalls}
  Success Rate: ${((1 - metrics.failureRate) * 100).toFixed(2)}%
  Average Response Time: ${metrics.averageResponseTime}ms
  Current State: ${metrics.state}
`);
```

### CircuitState

Enumeration of possible circuit breaker states.

```typescript
enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}
```

**Values:**

| State       | Description                                                       |
| ----------- | ----------------------------------------------------------------- |
| `CLOSED`    | Normal operation, calls are allowed through                       |
| `OPEN`      | Circuit is open, calls are blocked                                |
| `HALF_OPEN` | Testing state, limited calls allowed to test if service recovered |

**Example:**

```typescript
import { CircuitState } from "bulwark";

if (breaker.getState() === CircuitState.OPEN) {
  console.log("Circuit is open, calls are blocked");
}
```

---

## Errors

### CircuitBreakerError

Error thrown when the circuit breaker prevents an operation.

```typescript
class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}
```

**Properties:**

| Property  | Type           | Description                                          |
| --------- | -------------- | ---------------------------------------------------- |
| `message` | `string`       | Error message describing why the call was blocked    |
| `state`   | `CircuitState` | The state of the circuit breaker when error occurred |
| `name`    | `string`       | Always "CircuitBreakerError"                         |

**Example:**

```typescript
try {
  await breaker.execute(() => apiCall());
} catch (error) {
  if (error instanceof CircuitBreakerError) {
    console.log(`Circuit breaker error: ${error.message}`);
    console.log(`Circuit state: ${error.state}`);
  }
}
```

---

## Constants

### DEFAULT_CONFIG

Default configuration values for the circuit breaker.

```typescript
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  timeout: 5000,
  resetTimeout: 60000,
  monitoringPeriod: 10000,
};
```

**Usage:**

```typescript
import { DEFAULT_CONFIG } from "bulwark";

console.log("Default failure threshold:", DEFAULT_CONFIG.failureThreshold);

// Create breaker with partial config (rest uses defaults)
const breaker = new CircuitBreaker({
  failureThreshold: 3, // Override default
  // timeout, resetTimeout, monitoringPeriod use defaults
});
```

---

## Usage Patterns

### Basic Usage

```typescript
import { CircuitBreaker } from "bulwark";

const breaker = new CircuitBreaker();

async function protectedApiCall() {
  try {
    const result = await breaker.execute(async () => {
      const response = await fetch("/api/endpoint");
      if (!response.ok) throw new Error("API Error");
      return response.json();
    });
    return result;
  } catch (error) {
    console.error("Call failed:", error.message);
    throw error;
  }
}
```

### Advanced Configuration

```typescript
import { CircuitBreaker, CircuitState } from "bulwark";

const breaker = new CircuitBreaker({
  failureThreshold: 3, // Open after 3 failures
  timeout: 2000, // 2 second timeout
  resetTimeout: 30000, // Try again after 30 seconds
  monitoringPeriod: 5000, // Monitor every 5 seconds
});

// Monitor state changes
setInterval(() => {
  const metrics = breaker.getMetrics();
  if (metrics.state === CircuitState.OPEN) {
    console.log("⚠️  Circuit is OPEN - calls blocked");
  }
}, 1000);
```

### Error Handling

```typescript
import { CircuitBreaker, CircuitBreakerError } from "bulwark";

async function handleProtectedCall() {
  try {
    const result = await breaker.execute(() => riskyOperation());
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      // Circuit breaker prevented the call
      return {
        success: false,
        reason: "circuit_open",
        message: error.message,
      };
    } else {
      // The operation itself failed
      return {
        success: false,
        reason: "operation_failed",
        message: error.message,
      };
    }
  }
}
```

---

## Version Notes

### v0.0.1 (Current)

- ✅ Complete API structure and types
- ✅ Constructor and configuration
- ✅ State management methods
- ✅ Metrics collection interface
- ❌ `execute()` method not implemented (throws "Not implemented")

### v0.1.0 (Planned)

- ✅ Full `execute()` method implementation
- ✅ Complete state machine logic
- ✅ Timeout handling
- ✅ Metrics tracking

---

## TypeScript Support

Bulwark is built with TypeScript-first design:

```typescript
// Full type safety
const breaker = new CircuitBreaker<UserData>({
  failureThreshold: 3,
});

// Type inference
const userData: UserData = await breaker.execute(async () => {
  return await fetchUserData(userId);
});

// Generic operations
async function createProtectedCall<T>(
  operation: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const breaker = new CircuitBreaker<T>(config);
  return breaker.execute(operation);
}
```

---

## Performance Considerations

- **Zero Dependencies**: No external runtime dependencies
- **Minimal Overhead**: Designed for high-performance applications
- **Memory Efficient**: Optimized memory usage for metrics and state
- **TypeScript Optimized**: Compile-time optimizations with proper types

---

## Migration Guide

When upgrading between versions, refer to the [CHANGELOG](../../CHANGELOG.md) for breaking changes and migration instructions.

---

**For more examples and guides, see the [examples directory](../../examples/).**
