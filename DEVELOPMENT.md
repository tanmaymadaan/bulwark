# Bulwark Development Best Practices

**Version**: 1.0  
**Last Updated**: June 4, 2025

This document outlines the development standards, conventions, and best practices for the Bulwark circuit breaker library. All contributors and AI agents working on this codebase should follow these guidelines to ensure consistency, quality, and maintainability.

---

## 🎯 Project Goals & Philosophy

### Core Principles

- **TypeScript-First**: Native TypeScript, not bolted-on types
- **Developer Experience**: Simple API, smart defaults, progressive complexity
- **Performance**: <1ms overhead, minimal bundle size
- **Community-Focused**: Open development, excellent documentation
- **Production-Ready**: Enterprise-grade reliability and observability

### Quality Standards

- **Zero Critical Bugs**: Comprehensive testing and validation
- **95%+ Test Coverage**: All public APIs thoroughly tested
- **Semantic Versioning**: Strict adherence to semver principles
- **Documentation-Driven**: Code changes must include documentation updates

---

## 📝 Git Commit Standards

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type       | Description        | Example                                                 |
| ---------- | ------------------ | ------------------------------------------------------- |
| `feat`     | New features       | `feat(core): add adaptive timeout detection`            |
| `fix`      | Bug fixes          | `fix(metrics): resolve memory leak in sliding window`   |
| `docs`     | Documentation      | `docs(api): add circuit breaker configuration examples` |
| `style`    | Code formatting    | `style: fix ESLint violations in core module`           |
| `refactor` | Code restructuring | `refactor(state): simplify state transition logic`      |
| `test`     | Testing changes    | `test(integration): add Axios integration test suite`   |
| `chore`    | Maintenance        | `chore: update dependencies to latest versions`         |
| `perf`     | Performance        | `perf(core): optimize failure detection algorithm`      |
| `ci`       | CI/CD changes      | `ci: add automated security scanning workflow`          |

### Commit Message Examples

**✅ Good Examples:**

```bash
feat(core): implement circuit breaker state machine

- Add CLOSED, OPEN, HALF_OPEN states with proper transitions
- Implement failure threshold detection with configurable limits
- Include comprehensive unit tests with edge case coverage
- Performance benchmarks show <0.5ms overhead per call

Closes #12

---

fix(integrations): resolve Axios interceptor memory leak

- Fix event listener cleanup in request/response interceptors
- Add proper cleanup in circuit breaker disposal method
- Include regression test to prevent future memory leaks
- Memory usage now stable under high load conditions

Fixes #45

---

docs(examples): add payment gateway integration guide

- Create comprehensive example for payment service integration
- Include error handling patterns and fallback strategies
- Add TypeScript types and JSDoc annotations
- Cover both basic and advanced configuration scenarios

---

perf(metrics): optimize sliding window performance

- Replace array-based implementation with circular buffer
- Reduce memory allocation by 60% under high throughput
- Maintain O(1) insertion and O(n) aggregation complexity
- Include benchmark results in commit message

Before: 2.3ms avg, 45MB memory
After: 0.8ms avg, 18MB memory
```

**❌ Bad Examples:**

```bash
# Too vague
fix: bug fix

# Missing scope and details
feat: add new feature

# Not following convention
Fixed the timeout issue in circuit breaker

# No context or explanation
update code
```

### Commit Scope Guidelines

| Scope          | Description                | Files Typically Affected  |
| -------------- | -------------------------- | ------------------------- |
| `core`         | Core circuit breaker logic | `src/core/`               |
| `integrations` | HTTP client integrations   | `src/integrations/`       |
| `metrics`      | Metrics and monitoring     | `src/metrics/`            |
| `types`        | TypeScript definitions     | `src/types/`              |
| `utils`        | Utility functions          | `src/utils/`              |
| `examples`     | Example code               | `examples/`               |
| `docs`         | Documentation              | `docs/`, `*.md`           |
| `ci`           | CI/CD configuration        | `.github/`, build scripts |

---

## 🏗️ Code Standards

### TypeScript Configuration

- **Strict Mode**: Always enabled
- **No Any**: Avoid `any` type, use proper typing
- **Explicit Return Types**: For all public methods
- **JSDoc Comments**: Required for all public APIs

### Code Style

```typescript
// ✅ Good: Explicit types and documentation
/**
 * Executes an operation with circuit breaker protection
 * @param operation - The async operation to execute
 * @returns Promise that resolves with operation result
 * @throws CircuitBreakerError when circuit is open
 */
public async execute<T>(operation: () => Promise<T>): Promise<T> {
  if (this.state === CircuitState.OPEN) {
    throw new CircuitBreakerError('Circuit breaker is open');
  }

  return this.executeOperation(operation);
}

// ❌ Bad: Missing types and documentation
async execute(operation) {
  if (this.state === 'open') {
    throw new Error('Circuit is open');
  }
  return operation();
}
```

### Naming Conventions

- **Classes**: PascalCase (`CircuitBreaker`, `MetricsCollector`)
- **Methods/Functions**: camelCase (`execute`, `getMetrics`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_TIMEOUT`, `MAX_FAILURES`)
- **Interfaces**: PascalCase with descriptive names (`CircuitBreakerConfig`)
- **Types**: PascalCase (`CircuitState`, `FailureDetector`)

### File Organization

```
src/
├── core/
│   ├── CircuitBreaker.ts          # Main circuit breaker class
│   ├── StateManager.ts            # State transition logic
│   └── FailureDetector.ts         # Failure detection algorithms
├── integrations/
│   ├── AxiosIntegration.ts        # Axios-specific integration
│   ├── FetchIntegration.ts        # Fetch API integration
│   └── ExpressMiddleware.ts       # Express.js middleware
├── metrics/
│   ├── MetricsCollector.ts        # Core metrics collection
│   ├── SlidingWindow.ts           # Sliding window implementation
│   └── PrometheusExporter.ts      # Prometheus metrics export
├── types/
│   ├── index.ts                   # Main type exports
│   ├── config.ts                  # Configuration interfaces
│   └── metrics.ts                 # Metrics type definitions
└── utils/
    ├── Timer.ts                   # Timing utilities
    ├── Logger.ts                  # Logging utilities
    └── Validation.ts              # Input validation
```

---

## 🧪 Testing Standards

### Test Coverage Requirements

- **Unit Tests**: 95%+ coverage for all core functionality
- **Integration Tests**: All public APIs and integrations
- **Performance Tests**: Benchmark critical paths
- **Type Tests**: Verify TypeScript type safety

### Test Structure

```typescript
// ✅ Good test structure
describe("CircuitBreaker", () => {
  describe("execute()", () => {
    it("should execute operation when circuit is closed", async () => {
      // Arrange
      const breaker = new CircuitBreaker({ failureThreshold: 5 });
      const mockOperation = jest.fn().mockResolvedValue("success");

      // Act
      const result = await breaker.execute(mockOperation);

      // Assert
      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should throw error when circuit is open", async () => {
      // Arrange
      const breaker = new CircuitBreaker({ failureThreshold: 1 });
      await breaker.execute(() => Promise.reject(new Error("fail")));

      // Act & Assert
      await expect(breaker.execute(() => Promise.resolve("test"))).rejects.toThrow(
        CircuitBreakerError
      );
    });
  });
});
```

### Performance Testing

```typescript
// Include performance benchmarks for critical paths
describe("Performance", () => {
  it("should have <1ms overhead per call", async () => {
    const breaker = new CircuitBreaker();
    const operation = () => Promise.resolve("test");

    const start = process.hrtime.bigint();
    await breaker.execute(operation);
    const end = process.hrtime.bigint();

    const overhead = Number(end - start) / 1_000_000; // Convert to ms
    expect(overhead).toBeLessThan(1);
  });
});
```

---

## 📚 Documentation Standards

### Code Documentation

- **JSDoc**: Required for all public APIs
- **Type Annotations**: Explicit types for all parameters and returns
- **Examples**: Include usage examples in JSDoc
- **Error Conditions**: Document all possible errors

````typescript
/**
 * Circuit breaker for protecting against cascading failures
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   timeout: 3000
 * });
 *
 * const result = await breaker.execute(async () => {
 *   return await fetch('/api/data');
 * });
 * ```
 */
export class CircuitBreaker<T = any> {
  /**
   * Executes an operation with circuit breaker protection
   *
   * @param operation - Async operation to execute
   * @returns Promise resolving to operation result
   * @throws {CircuitBreakerError} When circuit is open
   * @throws {TimeoutError} When operation exceeds timeout
   */
  public async execute<R>(operation: () => Promise<R>): Promise<R> {
    // Implementation
  }
}
````

### README Updates

- **API Changes**: Update README for any public API changes
- **Examples**: Keep examples current and working
- **Migration**: Document breaking changes with migration guides

---

## 🔄 Development Workflow

### Branch Strategy

```
main                    # Production-ready code
├── develop            # Integration branch
├── feature/xyz        # Feature development
├── fix/abc           # Bug fixes
└── release/0.x.0     # Release preparation
```

### Pull Request Process

1. **Create Feature Branch**: `git checkout -b feature/adaptive-timeouts`
2. **Implement Changes**: Follow coding standards
3. **Write Tests**: Ensure 95%+ coverage
4. **Update Documentation**: Include relevant docs
5. **Performance Check**: Run benchmarks
6. **Create PR**: Use PR template
7. **Code Review**: Address feedback
8. **Merge**: Follow merge strategy guidelines below

### Merge Strategy

**Default Strategy: Squash and Merge**

We use **squash and merge** as our primary merge strategy for the following reasons:

- **Clean History**: Maintains a linear, readable commit history on main branches
- **Atomic Changes**: Each merge represents one complete feature/fix
- **Semantic Versioning**: Aligns with our strict semver approach
- **Quality Gates**: Ensures each commit on main has passed all quality checks
- **Easier Debugging**: Simplifies bisecting and identifying when issues were introduced
- **Professional Appearance**: Clean history for enterprise adoption

#### When to Use Squash and Merge

**✅ Use for (95% of cases):**

- Feature development (`feature/*`)
- Bug fixes (`fix/*`)
- Documentation updates (`docs/*`)
- Refactoring (`refactor/*`)
- Performance improvements (`perf/*`)
- Test additions (`test/*`)

**Example squash commit message:**

```
feat(core): implement adaptive timeout detection

- Add machine learning-based timeout adjustment algorithm
- Include comprehensive test suite with edge cases
- Add performance benchmarks showing <0.5ms overhead
- Update documentation with configuration examples

Closes #42
```

#### When to Use Regular Merge

**⚠️ Use sparingly for:**

- **Release merges**: `release/0.x.0` → `main`
- **Hotfix merges**: Critical security fixes where commit history matters
- **Large refactors**: When preserving individual commit context is valuable
- **Collaborative features**: Multiple developers where individual contributions should be preserved

**Example regular merge scenarios:**

```bash
# Release merge - preserve release preparation history
git merge --no-ff release/0.2.0

# Hotfix merge - preserve security fix audit trail
git merge --no-ff hotfix/security-vulnerability-cve-2024-001
```

#### When to Use Rebase and Merge

**❌ Generally avoid** - Can create confusion and doesn't align with our quality-first approach

### Merge Guidelines

#### For Feature Branches

1. **Squash Commits**: Combine all work commits into one logical unit
2. **Write Descriptive Message**: Follow conventional commit format
3. **Include Context**: Reference issues, breaking changes, performance impact
4. **Verify Tests**: Ensure 100% test passage before merge

#### For Release Branches

1. **Regular Merge**: Preserve release preparation commits
2. **Tag Immediately**: Create version tag after merge
3. **Update Changelog**: Ensure CHANGELOG.md is current
4. **Announce**: Notify community of release

#### Commit Message for Squashed Merges

```
<type>(scope): <description>

<detailed description of changes>

- Key change 1
- Key change 2
- Key change 3

Performance impact: <impact description>
Breaking changes: <none|description>
Migration guide: <link if applicable>

Closes #<issue-number>
```

### Branch Protection Rules

**Main Branch:**

- Require pull request reviews (minimum 1)
- Require status checks to pass
- Require branches to be up to date
- Require conversation resolution
- Restrict pushes to admins only

**Develop Branch:**

- Require pull request reviews (minimum 1)
- Require status checks to pass
- Allow force pushes for maintainers

### Release Process

1. **Code Freeze**: Stop new features, create `release/0.x.0` branch
2. **Testing**: Comprehensive test suite, manual testing
3. **Documentation**: Update CHANGELOG.md, API docs, examples
4. **Version Bump**: Update package.json, package-lock.json
5. **Release PR**: Create PR from `release/0.x.0` to `main`
6. **Regular Merge**: Use `git merge --no-ff` to preserve release history
7. **Tag Release**: `git tag -a v0.x.0 -m "Release v0.x.0"`
8. **Publish**: NPM publish, GitHub release
9. **Backmerge**: Merge `main` back to `develop`
10. **Announce**: Community updates, social media

---

## 🚀 Performance Guidelines

### Benchmarking Requirements

- **Overhead**: <1ms per circuit breaker call
- **Memory**: Stable memory usage under load
- **Bundle Size**: <20KB minified + gzipped
- **Startup Time**: <10ms initialization

### Performance Testing

```typescript
// Always include performance tests for critical paths
describe("Performance Benchmarks", () => {
  it("should maintain <1ms overhead under load", async () => {
    const breaker = new CircuitBreaker();
    const iterations = 10000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await breaker.execute(() => Promise.resolve(i));
    }
    const end = performance.now();

    const avgTime = (end - start) / iterations;
    expect(avgTime).toBeLessThan(1);
  });
});
```

---

## 🔍 Code Review Checklist

### For Reviewers

- [ ] **Functionality**: Does the code work as intended?
- [ ] **Tests**: Are there adequate tests with good coverage?
- [ ] **Performance**: Any performance implications?
- [ ] **Documentation**: Is the code properly documented?
- [ ] **Types**: Are TypeScript types correct and complete?
- [ ] **Standards**: Does it follow project conventions?
- [ ] **Security**: Any security concerns?
- [ ] **Breaking Changes**: Are breaking changes documented?

### For Authors

- [ ] **Self Review**: Review your own code first
- [ ] **Tests Pass**: All tests passing locally
- [ ] **Linting**: No ESLint/Prettier violations
- [ ] **Types**: TypeScript compilation successful
- [ ] **Documentation**: Updated relevant documentation
- [ ] **Examples**: Updated examples if needed
- [ ] **Performance**: Benchmarked critical changes
- [ ] **Changelog**: Updated if user-facing changes

---

## 🛠️ Tools & Automation

### Required Tools

- **TypeScript**: Latest stable version
- **ESLint**: With TypeScript rules
- **Prettier**: Code formatting
- **Jest**: Testing framework
- **Husky**: Git hooks
- **Commitizen**: Commit message formatting

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write", "jest --findRelatedTests --passWithNoTests"]
  }
}
```

---

## 📋 Definition of Done

A feature/fix is considered "done" when:

- [ ] **Code Complete**: Implementation matches requirements
- [ ] **Tests Written**: Unit and integration tests with 95%+ coverage
- [ ] **Documentation Updated**: API docs, README, examples
- [ ] **Performance Verified**: Benchmarks meet requirements
- [ ] **Code Reviewed**: Approved by at least one maintainer
- [ ] **CI Passing**: All automated checks pass
- [ ] **Types Complete**: Full TypeScript type safety
- [ ] **Examples Working**: All examples compile and run
- [ ] **Changelog Updated**: User-facing changes documented

---

## 🎯 AI Agent Guidelines

### When Working on This Codebase

1. **Read This Document First**: Understand all conventions
2. **Follow Commit Standards**: Use conventional commit format
3. **Include Tests**: Never submit code without tests
4. **Document Changes**: Update relevant documentation
5. **Performance Check**: Benchmark performance-critical changes
6. **Type Safety**: Ensure full TypeScript compliance
7. **Ask Questions**: When in doubt, ask for clarification

### Code Generation Best Practices

- **Generate Complete Solutions**: Include tests, docs, and types
- **Follow Project Patterns**: Match existing code style
- **Include Error Handling**: Proper error types and messages
- **Add Performance Considerations**: Consider memory and CPU impact
- **Provide Examples**: Show how to use new features

---

_This document is a living guide and should be updated as the project evolves. All contributors are expected to follow these practices to maintain code quality and project consistency._
