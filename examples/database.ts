import { CircuitBreaker } from "../src/core/CircuitBreaker";
import { ErrorClassifier, ErrorType } from "../src/utils/Errors";
import { Timer } from "../src/utils/Timer";

/**
 * Database Circuit Breaker Example
 *
 * This example demonstrates how to use Bulwark to protect database operations
 * from connection failures, timeouts, and connection pool exhaustion.
 */

// Simulate database connection and operations
interface DatabaseConnection {
  id: string;
  isActive: boolean;
  lastUsed: number;
}

interface QueryResult {
  rows: any[];
  rowCount: number;
  executionTime: number;
}

interface DatabaseError extends Error {
  code?: string;
  severity?: string;
  constraint?: string;
}

class MockDatabase {
  private connections: DatabaseConnection[] = [];
  private maxConnections: number = 10;
  private connectionFailureRate: number = 0;
  private queryFailureRate: number = 0;
  private isDown: boolean = false;
  private latency: number = 50;

  constructor() {
    // Initialize connection pool
    for (let i = 0; i < this.maxConnections; i++) {
      this.connections.push({
        id: `conn-${i}`,
        isActive: false,
        lastUsed: 0,
      });
    }
  }

  setConnectionFailureRate(rate: number) {
    this.connectionFailureRate = rate;
  }

  setQueryFailureRate(rate: number) {
    this.queryFailureRate = rate;
  }

  setDatabaseDown(down: boolean) {
    this.isDown = down;
  }

  setLatency(ms: number) {
    this.latency = ms;
  }

  exhaustConnectionPool() {
    this.connections.forEach((conn) => {
      conn.isActive = true;
      conn.lastUsed = Date.now();
    });
  }

  restoreConnectionPool() {
    this.connections.forEach((conn) => {
      conn.isActive = false;
    });
  }

  private getConnection(): DatabaseConnection {
    if (this.isDown) {
      const error = new Error("Database server is down") as DatabaseError;
      error.code = "CONNECTION_REFUSED";
      throw error;
    }

    if (Math.random() < this.connectionFailureRate) {
      const error = new Error("Failed to acquire database connection") as DatabaseError;
      error.code = "CONNECTION_TIMEOUT";
      throw error;
    }

    const availableConnection = this.connections.find((conn) => !conn.isActive);
    if (!availableConnection) {
      const error = new Error("Connection pool exhausted") as DatabaseError;
      error.code = "POOL_EXHAUSTED";
      throw error;
    }

    availableConnection.isActive = true;
    availableConnection.lastUsed = Date.now();
    return availableConnection;
  }

  private releaseConnection(connection: DatabaseConnection) {
    connection.isActive = false;
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    const connection = this.getConnection();

    try {
      await Timer.delay(this.latency + Math.random() * 50);

      if (Math.random() < this.queryFailureRate) {
        const error = new Error("Query execution failed") as DatabaseError;
        error.code = "QUERY_FAILED";
        error.severity = "ERROR";
        throw error;
      }

      // Simulate different types of queries
      const mockData = this.generateMockData(sql);

      return {
        rows: mockData,
        rowCount: mockData.length,
        executionTime: this.latency + Math.random() * 50,
      };
    } finally {
      this.releaseConnection(connection);
    }
  }

  async transaction<T>(operations: () => Promise<T>): Promise<T> {
    const connection = this.getConnection();

    try {
      await Timer.delay(10); // Begin transaction overhead
      const result = await operations();
      await Timer.delay(10); // Commit overhead
      return result;
    } catch (error) {
      await Timer.delay(5); // Rollback overhead
      throw error;
    } finally {
      this.releaseConnection(connection);
    }
  }

  private generateMockData(sql: string): any[] {
    const lowerSql = sql.toLowerCase();

    if (lowerSql.includes("select")) {
      if (lowerSql.includes("users")) {
        return [
          { id: 1, name: "John Doe", email: "john@example.com", created_at: new Date() },
          { id: 2, name: "Jane Smith", email: "jane@example.com", created_at: new Date() },
        ];
      } else if (lowerSql.includes("orders")) {
        return [
          { id: 101, user_id: 1, amount: 99.99, status: "completed", created_at: new Date() },
          { id: 102, user_id: 2, amount: 149.99, status: "pending", created_at: new Date() },
        ];
      }
    }

    return [{ affected_rows: 1, insert_id: Math.floor(Math.random() * 1000) }];
  }

  getConnectionPoolStatus() {
    const active = this.connections.filter((conn) => conn.isActive).length;
    const available = this.connections.length - active;

    return {
      total: this.connections.length,
      active,
      available,
      utilization: ((active / this.connections.length) * 100).toFixed(1) + "%",
    };
  }
}

// Create database instance and circuit breakers
const database = new MockDatabase();

// Circuit breaker for read operations (more tolerant)
const readCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  failureRateThreshold: 0.5,
  resetTimeout: 30000, // 30 seconds
  timeout: 5000, // 5 seconds
  minimumThroughput: 3,
});

// Circuit breaker for write operations (less tolerant)
const writeCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  failureRateThreshold: 0.3,
  resetTimeout: 60000, // 1 minute
  timeout: 10000, // 10 seconds
  minimumThroughput: 2,
});

// Circuit breaker for transaction operations (most critical)
const transactionCircuitBreaker = new CircuitBreaker({
  failureThreshold: 2,
  failureRateThreshold: 0.2,
  resetTimeout: 120000, // 2 minutes
  timeout: 15000, // 15 seconds
  minimumThroughput: 1,
});

/**
 * User Repository with circuit breaker protection
 */
export class UserRepository {
  static async findById(id: number): Promise<any> {
    return readCircuitBreaker.execute(async () => {
      const result = await database.query("SELECT * FROM users WHERE id = ?", [id]);
      return result.rows[0];
    });
  }

  static async findByEmail(email: string): Promise<any> {
    return readCircuitBreaker.execute(async () => {
      const result = await database.query("SELECT * FROM users WHERE email = ?", [email]);
      return result.rows[0];
    });
  }

  static async findAll(limit: number = 100): Promise<any[]> {
    return readCircuitBreaker.execute(async () => {
      const result = await database.query("SELECT * FROM users LIMIT ?", [limit]);
      return result.rows;
    });
  }

  static async create(userData: any): Promise<any> {
    return writeCircuitBreaker.execute(async () => {
      const result = await database.query("INSERT INTO users (name, email) VALUES (?, ?)", [
        userData.name,
        userData.email,
      ]);
      return { id: result.rows[0].insert_id, ...userData };
    });
  }

  static async update(id: number, userData: any): Promise<any> {
    return writeCircuitBreaker.execute(async () => {
      await database.query("UPDATE users SET name = ?, email = ? WHERE id = ?", [
        userData.name,
        userData.email,
        id,
      ]);
      return { id, ...userData };
    });
  }

  static async delete(id: number): Promise<boolean> {
    return writeCircuitBreaker.execute(async () => {
      await database.query("DELETE FROM users WHERE id = ?", [id]);
      return true;
    });
  }

  static getMetrics() {
    return {
      read: readCircuitBreaker.getMetrics(),
      write: writeCircuitBreaker.getMetrics(),
    };
  }
}

/**
 * Order Repository with circuit breaker protection
 */
export class OrderRepository {
  static async findById(id: number): Promise<any> {
    return readCircuitBreaker.execute(async () => {
      const result = await database.query("SELECT * FROM orders WHERE id = ?", [id]);
      return result.rows[0];
    });
  }

  static async findByUserId(userId: number): Promise<any[]> {
    return readCircuitBreaker.execute(async () => {
      const result = await database.query("SELECT * FROM orders WHERE user_id = ?", [userId]);
      return result.rows;
    });
  }

  static async create(orderData: any): Promise<any> {
    return writeCircuitBreaker.execute(async () => {
      const result = await database.query(
        "INSERT INTO orders (user_id, amount, status) VALUES (?, ?, ?)",
        [orderData.userId, orderData.amount, orderData.status]
      );
      return { id: result.rows[0].insert_id, ...orderData };
    });
  }

  static async updateStatus(id: number, status: string): Promise<any> {
    return writeCircuitBreaker.execute(async () => {
      await database.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
      return { id, status };
    });
  }

  static getMetrics() {
    return {
      read: readCircuitBreaker.getMetrics(),
      write: writeCircuitBreaker.getMetrics(),
    };
  }
}

/**
 * Transaction Service with circuit breaker protection
 */
export class TransactionService {
  static async createUserWithOrder(userData: any, orderData: any): Promise<any> {
    return transactionCircuitBreaker.execute(async () => {
      return database.transaction(async () => {
        // Create user
        const userResult = await database.query("INSERT INTO users (name, email) VALUES (?, ?)", [
          userData.name,
          userData.email,
        ]);
        const userId = userResult.rows[0].insert_id;

        // Create order for the user
        const orderResult = await database.query(
          "INSERT INTO orders (user_id, amount, status) VALUES (?, ?, ?)",
          [userId, orderData.amount, "pending"]
        );
        const orderId = orderResult.rows[0].insert_id;

        return {
          user: { id: userId, ...userData },
          order: { id: orderId, userId, ...orderData },
        };
      });
    });
  }

  static async transferFunds(fromUserId: number, toUserId: number, amount: number): Promise<any> {
    return transactionCircuitBreaker.execute(async () => {
      return database.transaction(async () => {
        // Debit from source account
        await database.query("UPDATE accounts SET balance = balance - ? WHERE user_id = ?", [
          amount,
          fromUserId,
        ]);

        // Credit to destination account
        await database.query("UPDATE accounts SET balance = balance + ? WHERE user_id = ?", [
          amount,
          toUserId,
        ]);

        // Log the transaction
        await database.query(
          "INSERT INTO transactions (from_user_id, to_user_id, amount, type) VALUES (?, ?, ?, ?)",
          [fromUserId, toUserId, amount, "transfer"]
        );

        return { fromUserId, toUserId, amount, timestamp: new Date() };
      });
    });
  }

  static getMetrics() {
    return transactionCircuitBreaker.getMetrics();
  }
}

/**
 * Database Health Monitor
 */
export class DatabaseHealthMonitor {
  static async checkHealth(): Promise<any> {
    const connectionPool = database.getConnectionPoolStatus();
    const metrics = {
      read: readCircuitBreaker.getMetrics(),
      write: writeCircuitBreaker.getMetrics(),
      transaction: transactionCircuitBreaker.getMetrics(),
    };

    return {
      connectionPool,
      circuitBreakers: {
        read: {
          state: metrics.read.state,
          successRate:
            ((metrics.read.successCount / Math.max(metrics.read.totalRequests, 1)) * 100).toFixed(
              2
            ) + "%",
          averageResponseTime: metrics.read.averageResponseTime.toFixed(2) + "ms",
        },
        write: {
          state: metrics.write.state,
          successRate:
            ((metrics.write.successCount / Math.max(metrics.write.totalRequests, 1)) * 100).toFixed(
              2
            ) + "%",
          averageResponseTime: metrics.write.averageResponseTime.toFixed(2) + "ms",
        },
        transaction: {
          state: metrics.transaction.state,
          successRate:
            (
              (metrics.transaction.successCount / Math.max(metrics.transaction.totalRequests, 1)) *
              100
            ).toFixed(2) + "%",
          averageResponseTime: metrics.transaction.averageResponseTime.toFixed(2) + "ms",
        },
      },
      overall: this.calculateOverallHealth(metrics),
    };
  }

  private static calculateOverallHealth(metrics: any): string {
    const states = [metrics.read.state, metrics.write.state, metrics.transaction.state];

    if (states.every((state) => state === "CLOSED")) {
      return "HEALTHY";
    } else if (states.some((state) => state === "OPEN")) {
      return "DEGRADED";
    } else {
      return "RECOVERING";
    }
  }

  static async performHealthCheck(): Promise<boolean> {
    try {
      await readCircuitBreaker.execute(async () => {
        await database.query("SELECT 1");
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Advanced Database Service with custom error handling
 */
export class AdvancedDatabaseService {
  private customErrorClassifier = ErrorClassifier.createCustomClassifier([
    {
      condition: (error: any) => error.code === "CONNECTION_TIMEOUT",
      classification: {
        type: ErrorType.TIMEOUT,
        shouldTriggerCircuitBreaker: true,
        isRetryable: true,
        severity: "HIGH",
      },
    },
    {
      condition: (error: any) => error.code === "POOL_EXHAUSTED",
      classification: {
        type: ErrorType.DATABASE,
        shouldTriggerCircuitBreaker: true,
        isRetryable: true,
        severity: "CRITICAL",
      },
    },
    {
      condition: (error: any) => error.code === "QUERY_FAILED",
      classification: {
        type: ErrorType.DATABASE,
        shouldTriggerCircuitBreaker: false, // Don't open circuit for query errors
        isRetryable: false,
        severity: "MEDIUM",
      },
    },
  ]);

  async executeQuery(sql: string, params: any[] = [], options: any = {}): Promise<any> {
    const circuitBreaker = options.isWrite ? writeCircuitBreaker : readCircuitBreaker;

    try {
      return await circuitBreaker.execute(async () => {
        return await database.query(sql, params);
      });
    } catch (error) {
      const classification = this.customErrorClassifier(error);

      console.log(`Database error classification:`, {
        sql: sql.substring(0, 50) + "...",
        type: classification.type,
        shouldTriggerCircuitBreaker: classification.shouldTriggerCircuitBreaker,
        isRetryable: classification.isRetryable,
        severity: classification.severity,
      });

      // Handle different error types
      if (classification.type === ErrorType.DATABASE && classification.severity === "CRITICAL") {
        console.log("Critical database error detected, implementing fallback strategy");
        // Implement fallback strategy (cache, read replica, etc.)
      }

      throw error;
    }
  }

  async executeTransaction<T>(operations: () => Promise<T>): Promise<T> {
    try {
      return await transactionCircuitBreaker.execute(async () => {
        return await database.transaction(operations);
      });
    } catch (error) {
      const classification = this.customErrorClassifier(error);

      if (classification.severity === "CRITICAL") {
        console.log("Critical transaction error, alerting DBA team");
        // Send alerts to DBA team
      }

      throw error;
    }
  }
}

/**
 * Demonstration function
 */
export async function demonstrateDatabaseProtection() {
  console.log("🚀 Starting Database Circuit Breaker Demonstration\n");

  // Phase 1: Normal operation
  console.log("📊 Phase 1: Normal Database Operation");
  database.setQueryFailureRate(0.05); // 5% failure rate
  database.setLatency(50);

  try {
    // Test read operations
    const users = await UserRepository.findAll(5);
    console.log(`✅ Retrieved ${users.length} users`);

    // Test write operations
    const newUser = await UserRepository.create({
      name: "Test User",
      email: "test@example.com",
    });
    console.log(`✅ Created user with ID: ${newUser.id}`);

    // Test transaction
    const result = await TransactionService.createUserWithOrder(
      { name: "Transaction User", email: "tx@example.com" },
      { amount: 99.99, status: "pending" }
    );
    console.log(`✅ Transaction completed - User: ${result.user.id}, Order: ${result.order.id}`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log("\n📈 Connection Pool Status:", database.getConnectionPoolStatus());
  console.log("📈 Circuit Breaker Metrics:", UserRepository.getMetrics());

  // Phase 2: Connection pool exhaustion
  console.log("\n📊 Phase 2: Connection Pool Exhaustion");
  database.exhaustConnectionPool();

  for (let i = 0; i < 5; i++) {
    try {
      await UserRepository.findById(i + 1);
      console.log(`✅ Query ${i + 1} succeeded`);
    } catch (error) {
      console.log(`❌ Query ${i + 1} failed: ${error.message}`);
    }
  }

  console.log("\n📈 Connection Pool Status:", database.getConnectionPoolStatus());

  // Phase 3: Database failure
  console.log("\n📊 Phase 3: Database Server Failure");
  database.setDatabaseDown(true);

  for (let i = 0; i < 3; i++) {
    try {
      await OrderRepository.findById(i + 1);
      console.log(`✅ Order query ${i + 1} succeeded`);
    } catch (error) {
      console.log(`❌ Order query ${i + 1} failed: ${error.message}`);
    }
  }

  // Phase 4: Recovery
  console.log("\n📊 Phase 4: Database Recovery");
  database.setDatabaseDown(false);
  database.restoreConnectionPool();
  database.setQueryFailureRate(0.02); // 2% failure rate

  // Wait for circuit breaker reset
  console.log("⏳ Waiting for circuit breaker reset...");
  await Timer.delay(3000);

  try {
    const user = await UserRepository.findById(1);
    console.log(`✅ Database recovered - Retrieved user: ${user?.name || "Unknown"}`);

    const order = await OrderRepository.create({
      userId: 1,
      amount: 149.99,
      status: "pending",
    });
    console.log(`✅ Created order with ID: ${order.id}`);
  } catch (error) {
    console.log(`❌ Recovery attempt failed: ${error.message}`);
  }

  // Phase 5: Advanced service demonstration
  console.log("\n📊 Phase 5: Advanced Database Service");
  const advancedService = new AdvancedDatabaseService();

  try {
    await advancedService.executeQuery("SELECT * FROM users LIMIT 1");
    console.log("✅ Advanced service query successful");
  } catch (error) {
    console.log(`❌ Advanced service error: ${error.message}`);
  }

  // Health check
  console.log("\n🏥 Database Health Status:");
  const health = await DatabaseHealthMonitor.checkHealth();
  console.log("Overall Health:", health.overall);
  console.log("Connection Pool:", health.connectionPool);
  console.log("Circuit Breakers:", health.circuitBreakers);

  console.log("\n✨ Database Circuit Breaker demonstration completed!");
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateDatabaseProtection().catch(console.error);
}
