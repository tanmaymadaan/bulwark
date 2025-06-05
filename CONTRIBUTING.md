# Contributing to Bulwark

Thank you for your interest in contributing to Bulwark! We welcome contributions from the community and are excited to work with you.

## 🎯 Project Vision

Bulwark aims to be the modern, TypeScript-first circuit breaker library for Node.js. We're building a developer-friendly, high-performance solution that solves real-world problems with external service reliability.

## 🤝 How to Contribute

### Types of Contributions

- **Bug Reports**: Help us identify and fix issues
- **Feature Requests**: Suggest new functionality or improvements
- **Code Contributions**: Implement features, fix bugs, improve performance
- **Documentation**: Improve docs, examples, and guides
- **Testing**: Add test cases, improve coverage
- **Performance**: Optimize code, reduce overhead

### Getting Started

1. **Fork the Repository**

   ```bash
   git clone https://github.com/tanmaymadaan/bulwark.git
   cd bulwark
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Run Tests**

   ```bash
   npm test
   ```

4. **Build the Project**
   ```bash
   npm run build
   ```

## 📋 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Follow our [coding standards](#coding-standards)
- Write tests for new functionality
- Update documentation as needed
- Ensure all tests pass

### 3. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/). Format your commits as:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Examples:**

```bash
feat(core): add adaptive timeout detection
fix(metrics): resolve memory leak in sliding window
docs(api): add circuit breaker configuration examples
test(integration): add comprehensive error handling tests
```

**Commit Types:**

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code formatting (no logic changes)
- `refactor`: Code restructuring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

### 4. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:

- Clear title and description
- Reference any related issues
- Include screenshots/examples if applicable

## 🏗️ Coding Standards

### TypeScript Guidelines

- **Strict Mode**: Always use TypeScript strict mode
- **Explicit Types**: Provide explicit return types for public methods
- **No Any**: Avoid `any` type, use proper typing
- **JSDoc**: Document all public APIs

```typescript
/**
 * Executes an operation with circuit breaker protection
 * @param operation - The async operation to execute
 * @returns Promise that resolves with operation result
 * @throws CircuitBreakerError when circuit is open
 */
public async execute<T>(operation: () => Promise<T>): Promise<T> {
  // Implementation
}
```

### Code Style

- **Naming**: Use camelCase for variables/functions, PascalCase for classes
- **Constants**: Use SCREAMING_SNAKE_CASE
- **File Names**: Use PascalCase for classes, camelCase for utilities

### Performance Requirements

- **<1ms Overhead**: Circuit breaker calls must have minimal performance impact
- **Memory Efficient**: Stable memory usage under load
- **Bundle Size**: Keep the library lightweight

## 🧪 Testing Standards

### Test Coverage

- **95%+ Coverage**: All new code must have comprehensive tests
- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions
- **Performance Tests**: Benchmark critical paths

### Test Structure

```typescript
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
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- CircuitBreaker.test.ts
```

## 📚 Documentation Standards

### Code Documentation

- **JSDoc**: Required for all public APIs
- **Examples**: Include usage examples in documentation
- **Error Conditions**: Document all possible errors

### README Updates

- Update examples if API changes
- Keep installation instructions current
- Document breaking changes

## 🔍 Pull Request Guidelines

### Before Submitting

- [ ] All tests pass (`npm test`)
- [ ] Code follows style guidelines (`npm run lint`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Documentation is updated
- [ ] Performance benchmarks pass (if applicable)

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Performance tests added/updated
- [ ] All tests pass

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or breaking changes documented)
```

## 🐛 Bug Reports

### Before Reporting

1. Check existing issues to avoid duplicates
2. Try the latest version
3. Create a minimal reproduction case

### Bug Report Template

```markdown
**Describe the Bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Create circuit breaker with config...
2. Execute operation...
3. See error

**Expected Behavior**
What you expected to happen.

**Actual Behavior**
What actually happened.

**Environment**

- Node.js version:
- Bulwark version:
- TypeScript version:
- Operating System:

**Additional Context**
Any other context about the problem.
```

## 💡 Feature Requests

### Before Requesting

1. Check if the feature already exists
2. Review the project roadmap
3. Consider if it fits the project goals

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions you've considered.

**Additional context**
Any other context about the feature request.
```

## 🎯 Development Priorities

### Current Focus (v0.0.x)

- Core circuit breaker functionality
- State machine implementation
- Basic metrics collection
- Performance optimization

### Future Priorities

- HTTP client integrations
- Framework-specific helpers
- Advanced monitoring features
- Adaptive behavior

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community discussion
- **Documentation**: Check our comprehensive docs first

## 🏆 Recognition

Contributors will be:

- Listed in our README
- Mentioned in release notes
- Invited to join our contributor team

## 📄 License

By contributing to Bulwark, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for helping make Bulwark better! 🚀**
