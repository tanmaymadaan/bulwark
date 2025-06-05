# Bulwark Examples

This directory contains practical examples demonstrating how to use the Bulwark circuit breaker library.

## 📁 Available Examples

### `basic-usage.ts`

Comprehensive examples showing fundamental usage patterns:

- Zero configuration setup with smart defaults
- Custom configuration options
- Monitoring and metrics collection
- Error handling patterns
- State management

## 🚀 Running Examples

### Prerequisites

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### Running TypeScript Examples Directly

```bash
# Install ts-node for direct TypeScript execution
npm install -g ts-node

# Run basic usage examples
ts-node examples/basic-usage.ts
```

### Running Compiled Examples

```bash
# Compile TypeScript to JavaScript
npm run build

# Run the compiled example
node dist/examples/basic-usage.js
```

## 📚 Example Categories

### 1. Basic Usage

Simple circuit breaker setup and execution patterns.

```typescript
import { CircuitBreaker } from "bulwark";

const breaker = new CircuitBreaker();
const result = await breaker.execute(() => apiCall());
```

### 2. Configuration

Examples of different configuration options and their effects.

```typescript
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  timeout: 3000,
  resetTimeout: 60000,
});
```

### 3. Error Handling

Proper error handling patterns for circuit breaker and service errors.

```typescript
try {
  const result = await breaker.execute(() => operation());
} catch (error) {
  if (error instanceof CircuitBreakerError) {
    // Handle circuit breaker errors
  } else {
    // Handle service errors
  }
}
```

### 4. Monitoring

Using metrics and monitoring capabilities.

```typescript
const metrics = breaker.getMetrics();
console.log(`Success rate: ${(1 - metrics.failureRate) * 100}%`);
```

## 🎯 Real-World Scenarios

The examples demonstrate common real-world scenarios:

- **API Protection**: Protecting HTTP API calls
- **Database Operations**: Wrapping database queries
- **Payment Processing**: Handling payment gateway calls
- **Microservice Communication**: Service-to-service calls

## 📝 Notes for v0.0.1

**Important**: The current v0.0.1 release includes the complete API structure but the `execute()` method is not yet implemented. It will throw a "Not implemented" error.

These examples show the planned API for v0.1.0 when full functionality will be available. The examples are designed to:

1. **Demonstrate the API**: Show how the library will work
2. **Guide Development**: Serve as specifications for implementation
3. **Test Integration**: Validate the TypeScript types and interfaces

## 🔄 Version Compatibility

- **v0.0.1**: API structure only, `execute()` not implemented
- **v0.0.2**: Basic state machine implementation
- **v0.1.0**: Full functionality, all examples will work

## 🤝 Contributing Examples

We welcome additional examples! Please follow these guidelines:

1. **Clear Documentation**: Include comments explaining the example
2. **Real-World Relevance**: Show practical usage scenarios
3. **Error Handling**: Demonstrate proper error handling
4. **TypeScript**: Use full TypeScript with proper types

### Example Template

```typescript
/**
 * Example: [Brief Description]
 *
 * This example demonstrates [what it shows]
 */

import { CircuitBreaker } from "../src/index";

async function exampleFunction(): Promise<void> {
  // Example implementation
}

export { exampleFunction };
```

## 📞 Getting Help

If you have questions about the examples:

1. Check the main [README](../README.md)
2. Review the [API documentation](../docs/)
3. Open an issue on GitHub
4. Join our community discussions

---

**Happy coding with Bulwark! 🚀**
