# Binary Discovery & Auto-Install

Services that depend on external binaries (drivers, backends) use a discovery chain with optional auto-install.

## Discovery Precedence
1. **User-provided path** — Check `options.*Path` config. Fail fast if set but missing.
2. **PATH lookup** — `which`/`where` command (platform-aware)
3. **Common install locations** — OS-specific paths (cargo bin, homebrew, etc.)
4. **Auto-install** — If `autoInstall*` option enabled, install via package manager

## Naming Convention
```typescript
// Discovery: find*() returns path or undefined
function findTauriDriver(): string | undefined;

// Ensure: ensure*() returns Result, handles full chain
async function ensureTauriDriver(options): Promise<Result<DriverInstallSuccess, Error>>;
```

## Return Type
```typescript
interface DriverInstallSuccess {
  path: string;
  method: 'found' | 'installed' | 'cached';
}
type DriverInstallResult = Result<DriverInstallSuccess, Error>;
```

## Rules
- Always return `Result`, never throw from `ensure*()` functions
- `find*()` is pure discovery (no side effects), `ensure*()` may install
- On Windows, handle `.cmd`/`.exe` extensions and Git Bash path conversion
- Error messages must include install instructions for the user
- Auto-install should be opt-in (default `false`), not opt-out
