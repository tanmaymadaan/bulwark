import { ErrorClassifier, ErrorUtils, ErrorType } from "../../src/utils/Errors";

describe("ErrorClassifier", () => {
  describe("classify()", () => {
    it("should classify HTTP status codes correctly", () => {
      const testCases = [
        { status: 400, expectedType: ErrorType.VALIDATION },
        { status: 401, expectedType: ErrorType.AUTHENTICATION },
        { status: 403, expectedType: ErrorType.AUTHORIZATION },
        { status: 404, expectedType: ErrorType.VALIDATION },
        { status: 408, expectedType: ErrorType.TIMEOUT },
        { status: 429, expectedType: ErrorType.RATE_LIMIT },
        { status: 500, expectedType: ErrorType.INTERNAL_SERVER },
        { status: 502, expectedType: ErrorType.SERVICE_UNAVAILABLE },
        { status: 503, expectedType: ErrorType.SERVICE_UNAVAILABLE },
        { status: 504, expectedType: ErrorType.TIMEOUT },
      ];

      testCases.forEach(({ status, expectedType }) => {
        const error = { status };
        const classification = ErrorClassifier.classify(error);
        expect(classification.type).toBe(expectedType);
      });
    });

    it("should classify error names correctly", () => {
      const testCases = [
        { name: "TimeoutError", expectedType: ErrorType.TIMEOUT },
        { name: "NetworkError", expectedType: ErrorType.NETWORK },
        { name: "ValidationError", expectedType: ErrorType.VALIDATION },
        { name: "AuthenticationError", expectedType: ErrorType.AUTHENTICATION },
        { name: "AuthorizationError", expectedType: ErrorType.AUTHORIZATION },
        { name: "DatabaseError", expectedType: ErrorType.DATABASE },
      ];

      testCases.forEach(({ name, expectedType }) => {
        const error = { name };
        const classification = ErrorClassifier.classify(error);
        expect(classification.type).toBe(expectedType);
      });
    });

    it("should classify error codes correctly", () => {
      const testCases = [
        { code: "TIMEOUT", expectedType: ErrorType.TIMEOUT },
        { code: "NETWORK_ERROR", expectedType: ErrorType.NETWORK },
        { code: "VALIDATION_ERROR", expectedType: ErrorType.VALIDATION },
      ];

      testCases.forEach(({ code, expectedType }) => {
        const error = { code };
        const classification = ErrorClassifier.classify(error);
        expect(classification.type).toBe(expectedType);
      });
    });

    it("should classify based on error message keywords", () => {
      const testCases = [
        { message: "Connection timeout occurred", expectedType: ErrorType.TIMEOUT },
        { message: "Network connection failed", expectedType: ErrorType.NETWORK },
        { message: "Database connection error", expectedType: ErrorType.DATABASE },
        { message: "Rate limit exceeded", expectedType: ErrorType.RATE_LIMIT },
        { message: "Unauthorized access", expectedType: ErrorType.AUTHENTICATION },
        { message: "Forbidden resource", expectedType: ErrorType.AUTHORIZATION },
        { message: "Validation failed", expectedType: ErrorType.VALIDATION },
      ];

      testCases.forEach(({ message, expectedType }) => {
        const error = { message };
        const classification = ErrorClassifier.classify(error);
        expect(classification.type).toBe(expectedType);
      });
    });

    it("should default to EXTERNAL_SERVICE for unknown errors", () => {
      const error = { message: "Unknown error type" };
      const classification = ErrorClassifier.classify(error);
      expect(classification.type).toBe(ErrorType.EXTERNAL_SERVICE);
    });

    it("should handle errors without message property", () => {
      const error = {};
      const classification = ErrorClassifier.classify(error);
      expect(classification.type).toBe(ErrorType.EXTERNAL_SERVICE);
    });
  });

  describe("shouldTriggerCircuitBreaker()", () => {
    it("should trigger for network errors", () => {
      const error = { message: "Network error" };
      const classification = ErrorClassifier.classify(error);
      expect(classification.shouldTriggerCircuitBreaker).toBe(true);
    });

    it("should trigger for timeout errors", () => {
      const error = { message: "Timeout error" };
      const classification = ErrorClassifier.classify(error);
      expect(classification.shouldTriggerCircuitBreaker).toBe(true);
    });

    it("should trigger for service unavailable errors", () => {
      const error = { status: 503 };
      const classification = ErrorClassifier.classify(error);
      expect(classification.shouldTriggerCircuitBreaker).toBe(true);
    });

    it("should not trigger for authentication errors", () => {
      const error = { status: 401 };
      const classification = ErrorClassifier.classify(error);
      expect(classification.shouldTriggerCircuitBreaker).toBe(false);
    });

    it("should not trigger for validation errors", () => {
      const error = { status: 400 };
      const classification = ErrorClassifier.classify(error);
      expect(classification.shouldTriggerCircuitBreaker).toBe(false);
    });

    it("should trigger for rate limit only if high volume", () => {
      const lowVolumeError = { status: 429 };
      const highVolumeError = { status: 429, retryAfter: 120 };

      const lowVolumeClassification = ErrorClassifier.classify(lowVolumeError);
      const highVolumeClassification = ErrorClassifier.classify(highVolumeError);

      expect(lowVolumeClassification.shouldTriggerCircuitBreaker).toBe(false);
      expect(highVolumeClassification.shouldTriggerCircuitBreaker).toBe(true);
    });
  });

  describe("isRetryable()", () => {
    it("should mark network errors as retryable", () => {
      const error = { message: "Network error" };
      const classification = ErrorClassifier.classify(error);
      expect(classification.isRetryable).toBe(true);
    });

    it("should mark timeout errors as retryable", () => {
      const error = { message: "Timeout error" };
      const classification = ErrorClassifier.classify(error);
      expect(classification.isRetryable).toBe(true);
    });

    it("should not mark authentication errors as retryable", () => {
      const error = { status: 401 };
      const classification = ErrorClassifier.classify(error);
      expect(classification.isRetryable).toBe(false);
    });

    it("should not mark validation errors as retryable", () => {
      const error = { status: 400 };
      const classification = ErrorClassifier.classify(error);
      expect(classification.isRetryable).toBe(false);
    });

    it("should mark database errors as retryable unless permanent", () => {
      const retryableError = { message: "Database connection failed" };
      const permanentError = { message: "Database constraint violation" };

      const retryableClassification = ErrorClassifier.classify(retryableError);
      const permanentClassification = ErrorClassifier.classify(permanentError);

      expect(retryableClassification.isRetryable).toBe(true);
      expect(permanentClassification.isRetryable).toBe(false);
    });
  });

  describe("isPermanentError()", () => {
    it("should identify permanent errors by keywords", () => {
      const permanentErrors = [
        { message: "Resource not found" },
        { message: "Record does not exist" },
        { message: "Invalid input format" },
        { message: "Malformed request" },
        { message: "Syntax error in query" },
        { message: "Constraint violation occurred" },
      ];

      permanentErrors.forEach((error) => {
        const classification = ErrorClassifier.classify(error);
        // These should be classified as DATABASE or EXTERNAL_SERVICE and not retryable
        expect(classification.isRetryable).toBe(false);
      });
    });

    it("should not mark temporary errors as permanent", () => {
      const temporaryError = { message: "Temporary database issue" };
      const classification = ErrorClassifier.classify(temporaryError);
      expect(classification.isRetryable).toBe(true);
    });
  });

  describe("determineSeverity()", () => {
    it("should assign LOW severity to validation errors", () => {
      const error = { status: 400 };
      const classification = ErrorClassifier.classify(error);
      expect(classification.severity).toBe("LOW");
    });

    it("should assign LOW severity to authentication errors", () => {
      const error = { status: 401 };
      const classification = ErrorClassifier.classify(error);
      expect(classification.severity).toBe("LOW");
    });

    it("should assign MEDIUM severity to rate limit errors", () => {
      const error = { status: 429 };
      const classification = ErrorClassifier.classify(error);
      expect(classification.severity).toBe("MEDIUM");
    });

    it("should assign HIGH severity to network errors", () => {
      const error = { message: "Network error" };
      const classification = ErrorClassifier.classify(error);
      expect(classification.severity).toBe("HIGH");
    });

    it("should assign CRITICAL severity to database errors", () => {
      const error = { message: "Database error" };
      const classification = ErrorClassifier.classify(error);
      expect(classification.severity).toBe("CRITICAL");
    });

    it("should assign CRITICAL severity to internal server errors", () => {
      const error = { status: 500 };
      const classification = ErrorClassifier.classify(error);
      expect(classification.severity).toBe("CRITICAL");
    });

    it("should assign HIGH severity to unknown error types", () => {
      const error = { message: "Unknown error type" };
      const classification = ErrorClassifier.classify(error);
      expect(classification.severity).toBe("HIGH"); // EXTERNAL_SERVICE gets HIGH severity
    });
  });

  describe("createCustomClassifier()", () => {
    it("should apply custom rules before default classification", () => {
      const customRules = [
        {
          condition: (error: any) => error.message?.includes("custom"),
          classification: { type: ErrorType.VALIDATION, severity: "CRITICAL" as const },
        },
      ];

      const customClassifier = ErrorClassifier.createCustomClassifier(customRules);
      const error = { message: "custom error" };
      const classification = customClassifier(error);

      expect(classification.type).toBe(ErrorType.VALIDATION);
      expect(classification.severity).toBe("CRITICAL");
    });

    it("should fall back to default classification when no custom rules match", () => {
      const customRules = [
        {
          condition: (error: any) => error.message?.includes("specific"),
          classification: { type: ErrorType.VALIDATION },
        },
      ];

      const customClassifier = ErrorClassifier.createCustomClassifier(customRules);
      const error = { message: "network error" };
      const classification = customClassifier(error);

      expect(classification.type).toBe(ErrorType.NETWORK);
    });
  });
});

describe("ErrorUtils", () => {
  describe("getMessage()", () => {
    it("should return string errors as-is", () => {
      const error = "Simple error message";
      const message = ErrorUtils.getMessage(error);
      expect(message).toBe("Simple error message");
    });

    it("should extract message property from error objects", () => {
      const error = { message: "Error object message" };
      const message = ErrorUtils.getMessage(error);
      expect(message).toBe("Error object message");
    });

    it("should use toString() method when available", () => {
      const error = {
        toString: () => "Custom toString result",
      };
      const message = ErrorUtils.getMessage(error);
      expect(message).toBe("Custom toString result");
    });

    it("should return toString result for objects without message or toString", () => {
      const error = { code: 500 };
      const message = ErrorUtils.getMessage(error);
      expect(message).toBe("[object Object]");
    });

    it("should handle non-string message property", () => {
      const error = { message: 123 };
      const message = ErrorUtils.getMessage(error);
      expect(message).toBe("[object Object]");
    });

    it("should handle null and undefined", () => {
      expect(ErrorUtils.getMessage(null)).toBe("Unknown error");
      expect(ErrorUtils.getMessage(undefined)).toBe("Unknown error");
    });

    it("should handle primitive values", () => {
      expect(ErrorUtils.getMessage(42)).toBe("42");
      expect(ErrorUtils.getMessage(true)).toBe("true");
    });
  });

  describe("getStack()", () => {
    it("should extract stack trace from Error objects", () => {
      const error = new Error("Test error");
      const stack = ErrorUtils.getStack(error);
      expect(stack).toBeDefined();
      expect(typeof stack).toBe("string");
    });

    it("should return undefined for objects without stack", () => {
      const error = { message: "No stack" };
      const stack = ErrorUtils.getStack(error);
      expect(stack).toBeUndefined();
    });

    it("should return undefined for non-objects", () => {
      const stack = ErrorUtils.getStack("string error");
      expect(stack).toBeUndefined();
    });
  });

  describe("normalize()", () => {
    it("should return Error objects as-is", () => {
      const originalError = new Error("Original error");
      const normalized = ErrorUtils.normalize(originalError);
      expect(normalized).toBe(originalError);
    });

    it("should convert string to Error object", () => {
      const normalized = ErrorUtils.normalize("String error");
      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message).toBe("String error");
    });

    it("should preserve properties from object errors", () => {
      const error = {
        message: "Object error",
        code: 500,
        details: "Additional info",
      };
      const normalized = ErrorUtils.normalize(error);

      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message).toBe("Object error");
      expect((normalized as any).code).toBe(500);
      expect((normalized as any).details).toBe("Additional info");
    });

    it("should handle null and undefined", () => {
      const nullNormalized = ErrorUtils.normalize(null);
      const undefinedNormalized = ErrorUtils.normalize(undefined);

      expect(nullNormalized).toBeInstanceOf(Error);
      expect(undefinedNormalized).toBeInstanceOf(Error);
      expect(nullNormalized.message).toBe("Unknown error");
      expect(undefinedNormalized.message).toBe("Unknown error");
    });
  });
});
