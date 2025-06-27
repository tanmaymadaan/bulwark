import { CircuitBreaker } from "../src/core/CircuitBreaker";
import { ErrorClassifier, ErrorType } from "../src/utils/Errors";
import { Timer } from "../src/utils/Timer";

/**
 * HTTP API Circuit Breaker Example
 *
 * This example demonstrates how to use Bulwark to protect HTTP API calls
 * from failures, timeouts, and cascading failures.
 */

// Simulate HTTP client (in real usage, this would be axios, fetch, etc.)
interface HttpResponse {
  status: number;
  data: any;
  headers: Record<string, string>;
}

interface HttpError extends Error {
  status?: number;
  code?: string;
  response?: HttpResponse;
}

class MockHttpClient {
  private failureRate: number = 0;
  private latency: number = 50;
  private isDown: boolean = false;

  setFailureRate(rate: number) {
    this.failureRate = rate;
  }

  setLatency(ms: number) {
    this.latency = ms;
  }

  setServiceDown(down: boolean) {
    this.isDown = down;
  }

  async get(url: string): Promise<HttpResponse> {
    await Timer.delay(this.latency);

    if (this.isDown) {
      const error = new Error("Service Unavailable") as HttpError;
      error.status = 503;
      throw error;
    }

    if (Math.random() < this.failureRate) {
      const error = new Error("Internal Server Error") as HttpError;
      error.status = 500;
      throw error;
    }

    return {
      status: 200,
      data: { message: `Response from ${url}`, timestamp: Date.now() },
      headers: { "content-type": "application/json" },
    };
  }

  async post(url: string, data: any): Promise<HttpResponse> {
    await Timer.delay(this.latency);

    if (this.isDown) {
      const error = new Error("Service Unavailable") as HttpError;
      error.status = 503;
      throw error;
    }

    if (Math.random() < this.failureRate) {
      const error = new Error("Internal Server Error") as HttpError;
      error.status = 500;
      throw error;
    }

    return {
      status: 201,
      data: { id: Math.random().toString(36), ...data, created: Date.now() },
      headers: { "content-type": "application/json" },
    };
  }
}

// Create HTTP client and circuit breakers
const httpClient = new MockHttpClient();

// Circuit breaker for user service
const userServiceBreaker = new CircuitBreaker({
  failureThreshold: 5,
  failureRateThreshold: 0.5,
  resetTimeout: 30000, // 30 seconds
  timeout: 5000, // 5 seconds
  minimumThroughput: 3,
});

// Circuit breaker for order service with different configuration
const orderServiceBreaker = new CircuitBreaker({
  failureThreshold: 3,
  failureRateThreshold: 0.3,
  resetTimeout: 60000, // 1 minute
  timeout: 10000, // 10 seconds
  minimumThroughput: 2,
});

// Circuit breaker for external payment service (more tolerant)
const paymentServiceBreaker = new CircuitBreaker({
  failureThreshold: 10,
  failureRateThreshold: 0.7,
  resetTimeout: 120000, // 2 minutes
  timeout: 15000, // 15 seconds
  minimumThroughput: 5,
});

/**
 * User Service API calls
 */
export class UserService {
  static async getUser(userId: string): Promise<any> {
    return userServiceBreaker.execute(async () => {
      const response = await httpClient.get(`/api/users/${userId}`);
      return response.data;
    });
  }

  static async createUser(userData: any): Promise<any> {
    return userServiceBreaker.execute(async () => {
      const response = await httpClient.post("/api/users", userData);
      return response.data;
    });
  }

  static async updateUser(userId: string, userData: any): Promise<any> {
    return userServiceBreaker.execute(async () => {
      const response = await httpClient.post(`/api/users/${userId}`, userData);
      return response.data;
    });
  }

  static getMetrics() {
    return userServiceBreaker.getMetrics();
  }
}

/**
 * Order Service API calls
 */
export class OrderService {
  static async getOrder(orderId: string): Promise<any> {
    return orderServiceBreaker.execute(async () => {
      const response = await httpClient.get(`/api/orders/${orderId}`);
      return response.data;
    });
  }

  static async createOrder(orderData: any): Promise<any> {
    return orderServiceBreaker.execute(async () => {
      const response = await httpClient.post("/api/orders", orderData);
      return response.data;
    });
  }

  static async getUserOrders(userId: string): Promise<any[]> {
    return orderServiceBreaker.execute(async () => {
      const response = await httpClient.get(`/api/users/${userId}/orders`);
      return response.data;
    });
  }

  static getMetrics() {
    return orderServiceBreaker.getMetrics();
  }
}

/**
 * Payment Service API calls (external service)
 */
export class PaymentService {
  static async processPayment(paymentData: any): Promise<any> {
    return paymentServiceBreaker.execute(async () => {
      const response = await httpClient.post("/api/payments/process", paymentData);
      return response.data;
    });
  }

  static async getPaymentStatus(paymentId: string): Promise<any> {
    return paymentServiceBreaker.execute(async () => {
      const response = await httpClient.get(`/api/payments/${paymentId}/status`);
      return response.data;
    });
  }

  static async refundPayment(paymentId: string, amount?: number): Promise<any> {
    return paymentServiceBreaker.execute(async () => {
      const response = await httpClient.post(`/api/payments/${paymentId}/refund`, { amount });
      return response.data;
    });
  }

  static getMetrics() {
    return paymentServiceBreaker.getMetrics();
  }
}

/**
 * Advanced error handling with custom classification
 */
const customErrorClassifier = ErrorClassifier.createCustomClassifier([
  {
    condition: (error: any) => error.status === 429,
    classification: {
      type: ErrorType.RATE_LIMIT,
      shouldTriggerCircuitBreaker: false, // Don't open circuit for rate limits
      isRetryable: true,
      severity: "MEDIUM",
    },
  },
  {
    condition: (error: any) => error.status >= 500 && error.status < 600,
    classification: {
      type: ErrorType.INTERNAL_SERVER,
      shouldTriggerCircuitBreaker: true,
      isRetryable: true,
      severity: "CRITICAL",
    },
  },
]);

/**
 * Enhanced service with custom error handling
 */
export class EnhancedApiService {
  private circuitBreaker: CircuitBreaker;

  constructor(serviceName: string) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
      timeout: 5000,
    });
  }

  async makeRequest(url: string, options: any = {}): Promise<any> {
    try {
      return await this.circuitBreaker.execute(async () => {
        if (options.method === "POST") {
          return await httpClient.post(url, options.data);
        } else {
          return await httpClient.get(url);
        }
      });
    } catch (error) {
      // Classify the error for better handling
      const classification = customErrorClassifier(error);

      console.log(`Error classification:`, {
        type: classification.type,
        shouldTriggerCircuitBreaker: classification.shouldTriggerCircuitBreaker,
        isRetryable: classification.isRetryable,
        severity: classification.severity,
      });

      // Handle different error types
      if (classification.type === ErrorType.RATE_LIMIT) {
        console.log("Rate limit detected, implementing backoff strategy");
        // Implement exponential backoff or other rate limit handling
      } else if (classification.severity === "CRITICAL") {
        console.log("Critical error detected, alerting monitoring systems");
        // Send alerts to monitoring systems
      }

      throw error;
    }
  }

  getMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  getHealth() {
    const metrics = this.circuitBreaker.getMetrics();
    return {
      status: metrics.state,
      successRate:
        ((metrics.successCount / Math.max(metrics.totalRequests, 1)) * 100).toFixed(2) + "%",
      averageResponseTime: metrics.averageResponseTime.toFixed(2) + "ms",
      totalRequests: metrics.totalRequests,
      failureCount: metrics.failureCount,
      nextAttempt: metrics.nextAttempt,
    };
  }
}

/**
 * Demonstration function
 */
export async function demonstrateHttpApiProtection() {
  console.log("🚀 Starting HTTP API Circuit Breaker Demonstration\n");

  // Simulate normal operation
  console.log("📊 Phase 1: Normal Operation");
  httpClient.setFailureRate(0.1); // 10% failure rate
  httpClient.setLatency(100);

  try {
    for (let i = 0; i < 5; i++) {
      const user = await UserService.getUser(`user-${i}`);
      console.log(`✅ Retrieved user: ${user.message}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log("\n📈 User Service Metrics:", UserService.getMetrics());

  // Simulate service degradation
  console.log("\n📊 Phase 2: Service Degradation");
  httpClient.setFailureRate(0.6); // 60% failure rate
  httpClient.setLatency(200);

  for (let i = 0; i < 10; i++) {
    try {
      const order = await OrderService.getOrder(`order-${i}`);
      console.log(`✅ Retrieved order: ${order.message}`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log("\n📈 Order Service Metrics:", OrderService.getMetrics());

  // Simulate complete service failure
  console.log("\n📊 Phase 3: Service Failure");
  httpClient.setServiceDown(true);

  for (let i = 0; i < 5; i++) {
    try {
      const payment = await PaymentService.processPayment({
        amount: 100,
        currency: "USD",
        cardToken: "tok_123",
      });
      console.log(`✅ Payment processed: ${payment.id}`);
    } catch (error) {
      console.log(`❌ Payment failed: ${error.message}`);
    }
  }

  console.log("\n📈 Payment Service Metrics:", PaymentService.getMetrics());

  // Simulate recovery
  console.log("\n📊 Phase 4: Service Recovery");
  httpClient.setServiceDown(false);
  httpClient.setFailureRate(0.05); // 5% failure rate
  httpClient.setLatency(50);

  // Wait for circuit breaker reset
  console.log("⏳ Waiting for circuit breaker reset...");
  await Timer.delay(5000);

  for (let i = 0; i < 3; i++) {
    try {
      const user = await UserService.getUser(`recovered-user-${i}`);
      console.log(`✅ Service recovered - Retrieved user: ${user.message}`);
    } catch (error) {
      console.log(`❌ Recovery attempt failed: ${error.message}`);
    }
  }

  // Enhanced service demonstration
  console.log("\n📊 Phase 5: Enhanced Service with Custom Error Handling");
  const enhancedService = new EnhancedApiService("enhanced-api");

  try {
    await enhancedService.makeRequest("/api/enhanced/test");
    console.log("✅ Enhanced service request successful");
  } catch (error) {
    console.log(`❌ Enhanced service error: ${error.message}`);
  }

  console.log("\n🏥 Service Health Status:");
  console.log("User Service:", UserService.getMetrics().state);
  console.log("Order Service:", OrderService.getMetrics().state);
  console.log("Payment Service:", PaymentService.getMetrics().state);
  console.log("Enhanced Service:", enhancedService.getHealth());

  console.log("\n✨ HTTP API Circuit Breaker demonstration completed!");
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateHttpApiProtection().catch(console.error);
}
