# Typed Error Hierarchy

Services should use typed error classes with error codes for programmatic error handling.

## Base Pattern
```typescript
enum ErrorCode {
  DRIVER_NOT_FOUND = 'DRIVER_NOT_FOUND',
  PORT_ALLOCATION_FAILED = 'PORT_ALLOCATION_FAILED',
  BINARY_NOT_FOUND = 'BINARY_NOT_FOUND',
  // ... service-specific codes
}

class <Service>Error extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly cause?: Error,
    public readonly context?: Record<string, unknown>,
  ) { ... }
}
```

## Subclasses
Create focused subclasses for common failure categories:
```typescript
class DriverError extends <Service>Error { ... }
class BinaryNotFoundError extends <Service>Error { ... }
class PortAllocationError extends <Service>Error { ... }
```

## Type Guards
```typescript
function is<Service>Error(error: unknown): error is <Service>Error;
function hasErrorCode(error: unknown, code: ErrorCode): boolean;
```

## Rules
- Use `ErrorCode` enum, not string literals
- Always chain the original error via `cause` parameter
- Include structured `context` for debugging (binary name, port, path)
- `SevereServiceError` (from `webdriverio`) is still used in launchers to stop the runner
- Error messages must be user-actionable (include what to do, not just what went wrong)
