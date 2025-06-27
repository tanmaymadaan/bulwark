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
    it("should apply custom rules when condition matches", () => {
      const customRules = [
        {
          condition: (error: unknown) => (error as any)?.code === "CUSTOM_ERROR",
          classification: { type: ErrorType.NETWORK, severity: "CRITICAL" as const },
        },
      ];

      const customClassifier = ErrorClassifier.createCustomClassifier(customRules);
      const error = { code: "CUSTOM_ERROR", message: "Custom error" };
      const classification = customClassifier(error);

      expect(classification.type).toBe(ErrorType.NETWORK);
      expect(classification.severity).toBe("CRITICAL");
    });

    it("should fall back to default classification when no custom rule matches", () => {
      const customRules = [
        {
          condition: (error: unknown) => (error as any)?.code === "CUSTOM_ERROR",
          classification: { type: ErrorType.NETWORK },
        },
      ];

      const customClassifier = ErrorClassifier.createCustomClassifier(customRules);
      const error = { message: "Regular error" };
      const classification = customClassifier(error);

      // Should use default classification
      expect(classification.type).toBe(ErrorType.EXTERNAL_SERVICE);
    });
  });

  describe("Edge Cases and Missing Branches", () => {
    it("should handle null and undefined errors in getMessage", () => {
      const nullClassification = ErrorClassifier.classify(null);
      expect(nullClassification.type).toBe(ErrorType.EXTERNAL_SERVICE);

      const undefinedClassification = ErrorClassifier.classify(undefined);
      expect(undefinedClassification.type).toBe(ErrorType.EXTERNAL_SERVICE);
    });

    it("should handle number and boolean errors in getMessage", () => {
      const numberClassification = ErrorClassifier.classify(42);
      expect(numberClassification.type).toBe(ErrorType.EXTERNAL_SERVICE);

      const booleanClassification = ErrorClassifier.classify(true);
      expect(booleanClassification.type).toBe(ErrorType.EXTERNAL_SERVICE);
    });

    it("should handle objects with toString method that throws", () => {
      const errorWithBadToString = {
        toString: () => {
          throw new Error("toString failed");
        },
      };

      const classification = ErrorClassifier.classify(errorWithBadToString);
      expect(classification.type).toBe(ErrorType.EXTERNAL_SERVICE);
    });

    it("should handle objects with toString method that returns non-string", () => {
      const errorWithNonStringToString = {
        toString: () => 42,
      };

      const classification = ErrorClassifier.classify(errorWithNonStringToString);
      expect(classification.type).toBe(ErrorType.EXTERNAL_SERVICE);
    });

    it("should handle objects without toString method", () => {
      const errorWithoutToString = Object.create(null);
      errorWithoutToString.message = "test";

      const classification = ErrorClassifier.classify(errorWithoutToString);
      expect(classification.type).toBe(ErrorType.EXTERNAL_SERVICE);
    });

    it("should test isHighVolumeRateLimit with various scenarios", () => {
      // Test with null/undefined
      const nullError = null;
      const nullClassification = ErrorClassifier.classify(nullError);
      expect(nullClassification.shouldTriggerCircuitBreaker).toBe(true); // EXTERNAL_SERVICE triggers circuit breaker

      // Test with non-object
      const stringError = "rate limit error";
      const stringClassification = ErrorClassifier.classify(stringError);
      expect(stringClassification.shouldTriggerCircuitBreaker).toBe(true); // RATE_LIMIT with high volume indicators

      // Test with retry-after header (numeric string)
      const highVolumeError1 = { status: 429, retryAfter: "120" };
      const highVolumeClassification1 = ErrorClassifier.classify(highVolumeError1);
      expect(highVolumeClassification1.shouldTriggerCircuitBreaker).toBe(true);

      // Test with retry-after header (low value)
      const lowVolumeError1 = { status: 429, retryAfter: "30" };
      const lowVolumeClassification1 = ErrorClassifier.classify(lowVolumeError1);
      expect(lowVolumeClassification1.shouldTriggerCircuitBreaker).toBe(false);

      // Test with retry-after header (non-numeric)
      const invalidRetryAfter = { status: 429, retryAfter: "invalid" };
      const invalidClassification = ErrorClassifier.classify(invalidRetryAfter);
      expect(invalidClassification.shouldTriggerCircuitBreaker).toBe(false);

      // Test with "retry-after" (hyphenated version)
      const hyphenatedRetryAfter = { status: 429, "retry-after": "90" };
      const hyphenatedClassification = ErrorClassifier.classify(hyphenatedRetryAfter);
      expect(hyphenatedClassification.shouldTriggerCircuitBreaker).toBe(true);

      // Test with high volume indicators in message
      const highVolumeMessages = [
        "rate limit exceeded",
        "too many requests",
        "quota exceeded",
        "throttled",
        "rate limit",
        "429",
        "too many",
        "exceeded quota",
        "rate limiting",
        "request limit",
        "api limit",
      ];

      highVolumeMessages.forEach((message) => {
        const error = { status: 429, message };
        const classification = ErrorClassifier.classify(error);
        expect(classification.shouldTriggerCircuitBreaker).toBe(true);
      });
    });

    it("should test isPermanentError with various scenarios", () => {
      const permanentKeywords = [
        "not found",
        "does not exist",
        "invalid input",
        "malformed",
        "syntax error",
        "constraint violation",
      ];

      permanentKeywords.forEach((keyword) => {
        const error = { message: `Database error: ${keyword}` };
        const classification = ErrorClassifier.classify(error);
        // These should be classified as DATABASE and not retryable
        expect(classification.isRetryable).toBe(false);
      });

      // Test case-insensitive matching
      const upperCaseError = { message: "RECORD NOT FOUND" };
      const upperCaseClassification = ErrorClassifier.classify(upperCaseError);
      expect(upperCaseClassification.isRetryable).toBe(false);
    });

    it("should handle default case in determineSeverity", () => {
      // Create an error that will fall through to the default case
      const unknownError = { message: "unknown error type" };
      const classification = ErrorClassifier.classify(unknownError);
      expect(classification.severity).toBe("HIGH"); // EXTERNAL_SERVICE gets HIGH severity
    });

    it("should handle default case in shouldTriggerCircuitBreaker", () => {
      // Create an error that will fall through to the default case
      const unknownError = { message: "unknown error type" };
      const classification = ErrorClassifier.classify(unknownError);
      expect(classification.shouldTriggerCircuitBreaker).toBe(true); // Default case
    });

    it("should handle default case in isRetryable", () => {
      // Create an error that will fall through to the default case
      const unknownError = { message: "unknown error type" };
      const classification = ErrorClassifier.classify(unknownError);
      expect(classification.isRetryable).toBe(true); // Default case
    });
  });
});

describe("ErrorUtils", () => {
  describe("getMessage()", () => {
    it("should handle null and undefined", () => {
      expect(ErrorUtils.getMessage(null)).toBe("Unknown error");
      expect(ErrorUtils.getMessage(undefined)).toBe("Unknown error");
    });

    it("should handle Error instances", () => {
      const error = new Error("Test error message");
      expect(ErrorUtils.getMessage(error)).toBe("Test error message");
    });

    it("should handle string errors", () => {
      expect(ErrorUtils.getMessage("String error")).toBe("String error");
    });

    it("should handle number and boolean errors", () => {
      expect(ErrorUtils.getMessage(42)).toBe("42");
      expect(ErrorUtils.getMessage(true)).toBe("true");
      expect(ErrorUtils.getMessage(false)).toBe("false");
    });

    it("should handle objects with message property", () => {
      const error = { message: "Object error message" };
      expect(ErrorUtils.getMessage(error)).toBe("Object error message");
    });

    it("should handle objects with toString method", () => {
      const error = {
        toString: () => "Custom toString",
      };
      expect(ErrorUtils.getMessage(error)).toBe("Custom toString");
    });

    it("should handle objects with toString method that throws", () => {
      const error = {
        toString: () => {
          throw new Error("toString failed");
        },
      };
      expect(ErrorUtils.getMessage(error)).toBe("Unknown error");
    });

    it("should handle objects with toString method that returns non-string", () => {
      const error = {
        toString: () => 42,
      };
      expect(ErrorUtils.getMessage(error)).toBe("Unknown error");
    });

    it("should handle objects without toString method", () => {
      const error = Object.create(null);
      expect(ErrorUtils.getMessage(error)).toBe("Unknown error");
    });
  });

  describe("getStack()", () => {
    it("should return stack from Error objects", () => {
      const error = new Error("Test error");
      const stack = ErrorUtils.getStack(error);
      expect(typeof stack).toBe("string");
      expect(stack).toContain("Error: Test error");
    });

    it("should return stack from objects with stack property", () => {
      const error = { stack: "Custom stack trace" };
      expect(ErrorUtils.getStack(error)).toBe("Custom stack trace");
    });

    it("should return undefined for objects without stack", () => {
      const error = { message: "No stack" };
      expect(ErrorUtils.getStack(error)).toBeUndefined();
    });

    it("should return undefined for null and undefined", () => {
      expect(ErrorUtils.getStack(null)).toBeUndefined();
      expect(ErrorUtils.getStack(undefined)).toBeUndefined();
    });

    it("should return undefined for non-objects", () => {
      expect(ErrorUtils.getStack("string")).toBeUndefined();
      expect(ErrorUtils.getStack(42)).toBeUndefined();
      expect(ErrorUtils.getStack(true)).toBeUndefined();
    });
  });

  describe("normalize()", () => {
    it("should return Error instances as-is", () => {
      const error = new Error("Test error");
      const normalized = ErrorUtils.normalize(error);
      expect(normalized).toBe(error);
    });

    it("should convert null and undefined to Error", () => {
      const nullError = ErrorUtils.normalize(null);
      expect(nullError).toBeInstanceOf(Error);
      expect(nullError.message).toBe("Unknown error");

      const undefinedError = ErrorUtils.normalize(undefined);
      expect(undefinedError).toBeInstanceOf(Error);
      expect(undefinedError.message).toBe("Unknown error");
    });

    it("should convert strings to Error", () => {
      const error = ErrorUtils.normalize("String error");
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("String error");
    });

    it("should convert numbers and booleans to Error", () => {
      const numberError = ErrorUtils.normalize(42);
      expect(numberError).toBeInstanceOf(Error);
      expect(numberError.message).toBe("42");

      const booleanError = ErrorUtils.normalize(true);
      expect(booleanError).toBeInstanceOf(Error);
      expect(booleanError.message).toBe("true");
    });

    it("should convert objects with message to Error", () => {
      const obj = { message: "Object message", code: "ERR_CODE" };
      const error = ErrorUtils.normalize(obj);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Object message");
      expect((error as any).code).toBe("ERR_CODE");
    });

    it("should convert objects without message to Error", () => {
      const obj = { code: "ERR_CODE", data: "some data" };
      const error = ErrorUtils.normalize(obj);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Unknown error");
      expect((error as any).code).toBe("ERR_CODE");
      expect((error as any).data).toBe("some data");
    });

    it("should not copy reserved properties", () => {
      const obj = {
        message: "Test message",
        name: "CustomError",
        stack: "custom stack",
        code: "ERR_CODE",
      };
      const error = ErrorUtils.normalize(obj);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Test message");
      expect((error as any).code).toBe("ERR_CODE");
      // name and stack should not be copied as they are reserved
      expect(error.name).toBe("Error"); // Default Error name
    });

    it("should handle non-object types", () => {
      const symbolError = ErrorUtils.normalize(Symbol("test"));
      expect(symbolError).toBeInstanceOf(Error);
      expect(symbolError.message).toBe("Unknown error");
    });
  });
});
