# Result Type

Use `Result<T, E>` for operations that can fail, instead of try/catch or returning `undefined`.

## Type Definition

Located at `tauri-service/src/utils/result.ts` (should be moved to `native-utils` for cross-service use).

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function Ok<T>(value: T): Result<T, never>;
function Err<E>(error: E): Result<never, E>;
function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T };
function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E };
function unwrap<T, E>(result: Result<T, E>): T;  // throws if Err
function wrapAsync<T>(promise: Promise<T>): Promise<Result<T, Error>>;
```

## When to Use
- Binary/file discovery (found or not)
- Driver installation (success or failure with context)
- Version detection (found or not)
- Any "try X, fallback to Y" chains
- Returning error context without throwing

## When NOT to Use
- Service hooks that should stop the runner (use `SevereServiceError`)
- Simple validation that always throws
- Internal code where the caller is always in the same function

## Rules
- Check with `isOk()`/`isErr()`, access `.value`/`.error`
- **Never** use `.success`, `.data`, or `.result` properties
- Prefer `Result` over returning `undefined` to indicate failure
- Chain errors: `Err(new Error('context', { cause: originalError }))`
