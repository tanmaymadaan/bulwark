/**
 * Error classification utilities for circuit breaker
 */

/**
 * Predefined error types that should trigger circuit breaker
 */
export enum ErrorType {
  // Core error types
  TIMEOUT = "TIMEOUT",
  NETWORK = "NETWORK",
  VALIDATION = "VALIDATION",
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  RATE_LIMIT = "RATE_LIMIT",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  INTERNAL_SERVER = "INTERNAL_SERVER",
  DATABASE = "DATABASE",
  EXTERNAL_SERVICE = "EXTERNAL_SERVICE",
  UNKNOWN = "UNKNOWN",
  CLIENT_ERROR = "CLIENT_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR = "NOT_FOUND_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  SERVICE_UNAVAILABLE_ERROR = "SERVICE_UNAVAILABLE_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  type: ErrorType;
  shouldTriggerCircuitBreaker: boolean;
  isRetryable: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/**
 * Error classifier for determining how to handle different types of errors
 */
export class ErrorClassifier {
  private static readonly HTTP_STATUS_MAPPINGS: Record<number, ErrorType> = {
    400: ErrorType.VALIDATION,
    401: ErrorType.AUTHENTICATION,
    403: ErrorType.AUTHORIZATION,
    404: ErrorType.VALIDATION,
    408: ErrorType.TIMEOUT,
    429: ErrorType.RATE_LIMIT,
    500: ErrorType.INTERNAL_SERVER,
    502: ErrorType.SERVICE_UNAVAILABLE,
    503: ErrorType.SERVICE_UNAVAILABLE,
    504: ErrorType.TIMEOUT,
  };

  private static readonly ERROR_NAME_MAPPINGS: Record<string, ErrorType> = {
    TimeoutError: ErrorType.TIMEOUT,
    NetworkError: ErrorType.NETWORK,
    ConnectionError: ErrorType.NETWORK,
    AuthenticationError: ErrorType.AUTHENTICATION,
    AuthorizationError: ErrorType.AUTHORIZATION,
    ValidationError: ErrorType.VALIDATION,
    NotFoundError: ErrorType.VALIDATION,
    RateLimitError: ErrorType.RATE_LIMIT,
    ServiceUnavailableError: ErrorType.SERVICE_UNAVAILABLE,
    DatabaseError: ErrorType.DATABASE,
  };

  private static readonly ERROR_CODE_MAPPINGS: Record<string, ErrorType> = {
    ECONNREFUSED: ErrorType.NETWORK,
    ECONNRESET: ErrorType.NETWORK,
    ETIMEDOUT: ErrorType.TIMEOUT,
    ENOTFOUND: ErrorType.NETWORK,
    EHOSTUNREACH: ErrorType.NETWORK,
    TIMEOUT: ErrorType.TIMEOUT,
    NETWORK_ERROR: ErrorType.NETWORK,
    VALIDATION_ERROR: ErrorType.VALIDATION,
  };

  private static readonly MESSAGE_PATTERNS: Array<[RegExp, ErrorType]> = [
    [/database/i, ErrorType.DATABASE],
    [/timeout/i, ErrorType.TIMEOUT],
    [/network/i, ErrorType.NETWORK],
    [/connection/i, ErrorType.NETWORK],
    [/rate limit/i, ErrorType.RATE_LIMIT],
    [/unauthorized/i, ErrorType.AUTHENTICATION],
    [/forbidden/i, ErrorType.AUTHORIZATION],
    [/not found/i, ErrorType.VALIDATION],
    [/validation/i, ErrorType.VALIDATION],
    [/service unavailable/i, ErrorType.SERVICE_UNAVAILABLE],
  ];

  /**
   * Classifies an error and determines how it should be handled
   * @param {unknown} error - The error to classify
   * @returns {ErrorClassification} Error classification with handling instructions
   */
  static classify(error: unknown): ErrorClassification {
    const errorType = this.determineErrorType(error);

    return {
      type: errorType,
      shouldTriggerCircuitBreaker: this.shouldTriggerCircuitBreaker(errorType, error),
      isRetryable: this.isRetryable(errorType, error),
      severity: this.determineSeverity(errorType),
    };
  }

  /**
   * Determines the error type based on error properties
   * @param {unknown} error - The error to analyze
   * @returns {ErrorType} The classified error type
   */
  static determineErrorType(error: unknown): ErrorType {
    if (error === null || error === undefined) return ErrorType.EXTERNAL_SERVICE;

    // Check HTTP status codes
    if (typeof error === "object" && error !== null && "status" in error) {
      const errorObj = error as { status: unknown };
      const status = errorObj.status;
      if (typeof status === "number") {
        const statusType = this.classifyByStatusCode(status);
        if (statusType !== ErrorType.UNKNOWN) return statusType;
      }
    }

    // Check error name
    if (typeof error === "object" && error !== null && "name" in error) {
      const errorObj = error as { name: unknown };
      const name = errorObj.name;
      if (typeof name === "string" && name in this.ERROR_NAME_MAPPINGS) {
        const mappedType = this.ERROR_NAME_MAPPINGS[name];
        if (mappedType !== undefined && mappedType !== null) return mappedType;
      }
    }

    // Check error code
    if (typeof error === "object" && error !== null && "code" in error) {
      const errorObj = error as { code: unknown };
      const code = errorObj.code;
      if (typeof code === "string" && code in this.ERROR_CODE_MAPPINGS) {
        const mappedType = this.ERROR_CODE_MAPPINGS[code];
        if (mappedType !== undefined && mappedType !== null) return mappedType;
      }
    }

    // Check message patterns
    const message = this.getMessage(error);
    for (const [pattern, type] of this.MESSAGE_PATTERNS) {
      if (pattern.test(message)) {
        return type;
      }
    }

    return ErrorType.EXTERNAL_SERVICE;
  }

  /**
   * Classifies an error by HTTP status code
   * @param {number} status - The HTTP status code
   * @returns {ErrorType} The corresponding error type
   */
  private static classifyByStatusCode(status: number): ErrorType {
    const mappedType = this.HTTP_STATUS_MAPPINGS[status];
    return mappedType !== undefined ? mappedType : ErrorType.EXTERNAL_SERVICE;
  }

  /**
   * Determines if an error should trigger the circuit breaker
   * @param {ErrorType} errorType - The classified error type
   * @param {unknown} error - The original error
   * @returns {boolean} True if the error should trigger circuit breaker
   */
  private static shouldTriggerCircuitBreaker(errorType: ErrorType, error: unknown): boolean {
    switch (errorType) {
      case ErrorType.NETWORK:
      case ErrorType.TIMEOUT:
      case ErrorType.SERVICE_UNAVAILABLE:
      case ErrorType.INTERNAL_SERVER:
      case ErrorType.DATABASE:
      case ErrorType.EXTERNAL_SERVICE:
        return true;

      case ErrorType.RATE_LIMIT:
        // Only trigger for severe rate limiting
        return this.isHighVolumeRateLimit(error);

      case ErrorType.AUTHENTICATION:
      case ErrorType.AUTHORIZATION:
      case ErrorType.VALIDATION:
        return false;

      default:
        return true;
    }
  }

  /**
   * Determines if an error is retryable
   * @param {ErrorType} errorType - The classified error type
   * @param {unknown} error - The original error
   * @returns {boolean} True if the error is retryable
   */
  private static isRetryable(errorType: ErrorType, error: unknown): boolean {
    switch (errorType) {
      case ErrorType.NETWORK:
      case ErrorType.TIMEOUT:
      case ErrorType.SERVICE_UNAVAILABLE:
      case ErrorType.RATE_LIMIT:
      case ErrorType.INTERNAL_SERVER:
        return true;

      case ErrorType.AUTHENTICATION:
      case ErrorType.AUTHORIZATION:
      case ErrorType.VALIDATION:
        return false;

      case ErrorType.DATABASE:
      case ErrorType.EXTERNAL_SERVICE:
        // Depends on specific error
        return !this.isPermanentError(error);

      default:
        return true;
    }
  }

  /**
   * Determines the severity of an error
   * @param {ErrorType} errorType - The classified error type
   * @returns {"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"} Error severity level
   */
  private static determineSeverity(errorType: ErrorType): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    switch (errorType) {
      case ErrorType.VALIDATION:
      case ErrorType.AUTHENTICATION:
      case ErrorType.AUTHORIZATION:
        return "LOW";

      case ErrorType.RATE_LIMIT:
        return "MEDIUM";

      case ErrorType.TIMEOUT:
      case ErrorType.NETWORK:
      case ErrorType.EXTERNAL_SERVICE:
        return "HIGH";

      case ErrorType.SERVICE_UNAVAILABLE:
      case ErrorType.INTERNAL_SERVER:
      case ErrorType.DATABASE:
        return "CRITICAL";

      default:
        return "MEDIUM";
    }
  }

  /**
   * Checks if rate limit error is high volume
   * @param {unknown} error - The error to check
   * @returns {boolean} True if it's a high volume rate limit
   */
  private static isHighVolumeRateLimit(error: unknown): boolean {
    if (error === null || error === undefined || typeof error !== "object") {
      return false;
    }

    const errorObj = error as Record<string, unknown>;

    // Check for retry-after header
    const retryAfter = (errorObj["retryAfter"] as string) || (errorObj["retry-after"] as string);
    if (retryAfter) {
      const retrySeconds = parseInt(retryAfter, 10);
      // Consider it high volume if retry-after is more than 60 seconds
      return !isNaN(retrySeconds) && retrySeconds > 60;
    }

    // Check for specific rate limit indicators in message
    const message = this.getMessage(error);
    const messageLower = message.toLowerCase();
    const highVolumeIndicators = [
      "rate limit exceeded",
      "too many requests",
      "quota exceeded",
      "throttled",
      "rate limit",
      "429", // HTTP status code for rate limit
      "too many",
      "exceeded quota",
      "rate limiting",
      "request limit",
      "api limit",
    ];

    return highVolumeIndicators.some((indicator) => messageLower.includes(indicator));
  }

  /**
   * Checks if an error is permanent (non-retryable)
   * @param {unknown} error - The error to check
   * @returns {boolean} True if the error is permanent
   */
  private static isPermanentError(error: unknown): boolean {
    const message = this.getMessage(error);
    const messageLower = message.toLowerCase();

    const permanentKeywords = [
      "not found",
      "does not exist",
      "invalid input",
      "malformed",
      "syntax error",
      "constraint violation",
    ];

    return permanentKeywords.some((keyword) => messageLower.includes(keyword));
  }

  /**
   * Creates a custom error classifier with user-defined rules
   * @param {Array<Object>} customRules - Custom classification rules
   * @returns {Function} A function that classifies errors using custom rules
   */
  static createCustomClassifier(
    customRules: Array<{
      condition: (error: unknown) => boolean;
      classification: Partial<ErrorClassification>;
    }>
  ): (error: unknown) => ErrorClassification {
    return (error: unknown): ErrorClassification => {
      for (const rule of customRules) {
        if (rule.condition(error)) {
          const baseClassification = this.classify(error);
          return {
            ...baseClassification,
            ...rule.classification,
          };
        }
      }

      return this.classify(error);
    };
  }

  /**
   * Gets the error message from an error object
   * @param {unknown} error - The error object to get message from
   * @returns {string} The error message
   */
  private static getMessage(error: unknown): string {
    if (error === null || error === undefined) {
      return "Unknown error";
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    if (typeof error === "number" || typeof error === "boolean") {
      return String(error);
    }

    if (typeof error === "object") {
      const errorObj = error as Record<string, unknown>;
      if (typeof errorObj.message === "string") {
        return errorObj.message;
      }
      if (typeof errorObj.toString === "function") {
        try {
          const result = (errorObj.toString as (this: void) => unknown)();
          return typeof result === "string" ? result : "Unknown error";
        } catch {
          return "Unknown error";
        }
      }
      // Handle objects without toString method
      return "Unknown error";
    }

    return "Unknown error";
  }
}

/**
 * Utility functions for error handling
 */
export class ErrorUtils {
  /**
   * Gets the error message from an error object
   * @param {unknown} error - The error object to get message from
   * @returns {string} The error message
   */
  static getMessage(error: unknown): string {
    if (error === null || error === undefined) {
      return "Unknown error";
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    if (typeof error === "number" || typeof error === "boolean") {
      return String(error);
    }

    if (typeof error === "object") {
      const errorObj = error as Record<string, unknown>;
      if (typeof errorObj.message === "string") {
        return errorObj.message;
      }
      if (typeof errorObj.toString === "function") {
        try {
          const result = (errorObj.toString as (this: void) => unknown)();
          return typeof result === "string" ? result : "Unknown error";
        } catch {
          return "Unknown error";
        }
      }
      // Handle objects without toString method
      return "Unknown error";
    }

    return "Unknown error";
  }

  /**
   * Extracts the stack trace from an error
   * @param {unknown} error - The error object
   * @returns {string | undefined} The stack trace or undefined if not available
   */
  static getStack(error: unknown): string | undefined {
    if (error !== null && error !== undefined && typeof error === "object") {
      const errorObj = error as Record<string, unknown>;
      if (typeof errorObj["stack"] === "string") {
        return errorObj["stack"];
      }
    }
    return undefined;
  }

  /**
   * Normalizes an error object for consistent handling
   * @param {unknown} error - The error to normalize
   * @returns {Error} A normalized Error object
   */
  static normalize(error: unknown): Error {
    if (error === null || error === undefined) {
      return new Error("Unknown error");
    }

    if (error instanceof Error) {
      return error;
    }

    if (typeof error === "string") {
      return new Error(error);
    }

    if (typeof error === "number" || typeof error === "boolean") {
      return new Error(String(error));
    }

    if (typeof error === "object") {
      const errorObj = error as Record<string, unknown>;
      const message = typeof errorObj.message === "string" ? errorObj.message : "Unknown error";
      const normalizedError = new Error(message);

      // Copy enumerable properties
      for (const key in errorObj) {
        if (key !== "message" && key !== "name" && key !== "stack") {
          (normalizedError as Record<string, unknown>)[key] = errorObj[key];
        }
      }

      return normalizedError;
    }

    return new Error("Unknown error");
  }
}
