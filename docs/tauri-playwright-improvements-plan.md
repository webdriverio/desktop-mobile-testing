# Implementation Plan: Improvements Inspired by tauri-playwright

**Date:** 2026-03-30
**Source Analysis:** [tauri-playwright-analysis.md](./tauri-playwright-analysis.md)

---

## Improvement Summary

| # | Improvement | Applies To | Effort | Impact | Status |
|---|-------------|------------|--------|--------|--------|
| 1 | Browser-only test mode with mocked native IPC | Tauri + Electron | Large | High | Pending |
| 2 | Direct WebView eval channel (supplement WebDriver) | Tauri (embedded) | Large | High | Pending |
| 3 | Multi-window label configuration | Tauri | Small | Medium | Pending |
| 4 | Native screenshot capture | Tauri + Electron | Medium | Low | Pending |
| 5 | Audit JS string interpolation / escaping | Tauri + Electron | Small | Medium | **Done** |
| 6 | IPC mock serialization pattern | Tauri + Electron | Medium | Medium | Pending |

---

## Improvement 1: Browser-Only Test Mode

### What

A new test mode where the Tauri or Electron app frontend runs in a standard browser (Chrome) against a dev server, with native APIs mocked at the JavaScript boundary. No real app binary or driver is needed.

### Why

- **Fast feedback loop**: No compilation, no driver startup, no binary resolution
- **CI-friendly**: No platform-specific drivers, no display server, no Rust toolchain
- **Frontend-focused tests**: Many tests only exercise the web UI and mock the backend anyway
- tauri-playwright demonstrates this works well — their "browser mode" is the most-used mode in CI

### Applies to: Tauri + Electron

Both frameworks have a JavaScript bridge that can be intercepted:
- **Tauri**: `window.__TAURI_INTERNALS__.invoke(cmd, args)` — all Tauri commands flow through this
- **Electron**: `window.electron.ipcRenderer.invoke(channel, ...args)` (or `send`/`sendSync`) — when using contextBridge preload patterns

### Design

```
┌──────────────────────────────────┐
│  WebdriverIO Test Runner         │
│  (standard browser session)      │
└──────────┬───────────────────────┘
           │ WebDriver (ChromeDriver)
           ▼
┌──────────────────────────────────┐
│  Chrome Browser                  │
│  ┌────────────────────────────┐  │
│  │  Vite Dev Server (UI)      │  │
│  │  + Injected IPC Mock Layer │  │
│  │                            │  │
│  │  invoke('greet', {name})   │  │
│  │    → intercepted by mock   │  │
│  │    → returns configured    │  │
│  │      response              │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

**Launcher behavior (browser-only mode):**
1. Skip driver startup entirely (no tauri-driver, no ChromeDriver with Electron binary)
2. Launch a standard Chrome session via ChromeDriver
3. Navigate to the configured dev server URL (e.g., `http://localhost:1420`)
4. Inject the IPC mock layer via `browser.execute()` or `addInitScript`

**Worker behavior (browser-only mode):**
1. Skip CDP bridge / plugin initialization
2. Set up the IPC mock layer that intercepts native calls
3. `browser.tauri.execute()` / `browser.electron.execute()` route to mock handlers instead of real backend
4. Mock system works as normal (outer mock tracks calls from the intercepted layer)

### Configuration

```typescript
// Tauri
{
  capabilities: [{
    browserName: 'chrome',
    'wdio:tauriServiceOptions': {
      mode: 'browser',          // NEW: 'browser' | 'native' (default)
      devServerUrl: 'http://localhost:1420',
      ipcMocks: {               // Optional: pre-configured mock responses
        'greet': { name: 'World' },
      },
    },
  }],
}

// Electron
{
  capabilities: [{
    browserName: 'chrome',      // Not 'electron' — real Chrome
    'wdio:electronServiceOptions': {
      mode: 'browser',          // NEW
      devServerUrl: 'http://localhost:3000',
      ipcMocks: { ... },
    },
  }],
}
```

### Implementation Steps

1. **Define `mode` option** in both `TauriServiceOptions` and `ElectronServiceOptions`
2. **Create IPC mock layer** in `@wdio/native-spy` (shared between services):
   - `createTauriIpcMock()` — wraps `window.__TAURI_INTERNALS__.invoke`
   - `createElectronIpcMock()` — wraps `window.electron.ipcRenderer` (or contextBridge equivalent)
   - Both return a mock registry that integrates with existing `ServiceMockStore`
3. **Update launchers** to skip driver/binary logic when `mode === 'browser'`
4. **Update workers** to inject mock layer instead of connecting to app process
5. **Adapt `execute()` commands** to route through mock layer in browser mode
6. **Add E2E tests** for browser-only mode in both services

### Open Questions

- Should browser mode support `browser.tauri.execute()` at all, or only mock-based testing?
- How to handle Tauri event listeners (`listen`, `emit`) in browser mode?
- Should we auto-start the Vite dev server, or require it to be running?
- For Electron: which preload pattern(s) to support? (contextBridge is recommended but not universal)

---

## Improvement 2: Direct WebView Eval Channel

### What

Extend the embedded Tauri plugin (`tauri-plugin-wdio-webdriver`) to support direct JavaScript evaluation in the webview via `WebviewWindow::eval()`, with results returned via Tauri IPC. This supplements — not replaces — the WebDriver protocol.

### Why

- **Faster Tauri command execution**: `browser.tauri.execute()` currently goes through WebDriver's `execute` command, adding serialization overhead
- **Richer return types**: Direct IPC can handle types that WebDriver JSON wire protocol struggles with
- **Better mock sync**: Mock state could sync more efficiently through a direct channel
- **Validated by PR #1**: tauri-playwright's PR #1 proves `WebviewWindow::eval()` + IPC is reliable and simpler than HTTP polling

### Applies to: Tauri only (embedded provider)

Electron already has this via CDP (`Runtime.callFunctionOn`). This improvement brings Tauri's embedded provider to parity.

### Design

```
┌─────────────────────────────┐
│  WebdriverIO Worker         │
│  browser.tauri.execute()    │
└──────────┬──────────────────┘
           │ (1) JSON command via socket/HTTP
           ▼
┌─────────────────────────────────────┐
│  tauri-plugin-wdio-webdriver        │
│  (Rust, in Tauri app process)       │
│                                     │
│  (2) WebviewWindow::eval(script)    │
│      ↓                              │
│  (3) Script runs in webview         │
│      ↓                              │
│  (4) Result via invoke('pw_result') │
│      ↓                              │
│  (5) Response back via socket/HTTP  │
└─────────────────────────────────────┘
```

Key learnings from tauri-playwright PR #1 to apply:
- Use `WebviewWindow::eval()` instead of HTTP polling (eliminates 16ms latency + 2 round-trips)
- Use `serde_json::to_string()` for all JS string interpolation (not manual escaping)
- Add Tauri 2 permissions (`build.rs`, `default.toml`, schema) for any new IPC commands
- Handle window readiness: retry/backoff if `get_webview_window()` returns `None`
- Avoid `eval()` / `new Function()` in injected JS to prevent CSP issues

### Implementation Steps

1. **Add `eval_js` command** to `tauri-plugin-wdio-webdriver`:
   - Accept script + args as JSON
   - Wrap in try-catch IIFE
   - Execute via `webview.eval()`
   - Return result via `invoke('wdio_eval_result')` IPC command
2. **Add Tauri 2 permission scaffolding**: `build.rs`, permission TOML, schema
3. **Add `wdio_eval_result` IPC handler** in plugin init
4. **Create `DirectEvalBridge` class** in tauri-service TypeScript:
   - Connect to plugin's socket/HTTP endpoint
   - Send eval commands, receive results
   - Timeout handling and retry logic
5. **Route `browser.tauri.execute()`** through direct eval when embedded provider is active
6. **Route mock sync** through direct eval for faster updates
7. **Add window label configuration** (ties into Improvement 3)

### Open Questions

- Should we use the same socket that the embedded WebDriver server uses, or a separate channel?
- How to handle the transition — should `execute()` automatically pick the best channel, or should users opt in?
- What's the fallback behavior if the direct channel fails? (Silent fallback to WebDriver `execute`?)

---

## Improvement 3: Multi-Window Label Configuration

### What

Add a `windowLabel` option to `TauriServiceOptions` that controls which webview window the service targets for Tauri-specific operations.

### Why

- Multi-window Tauri apps need to target specific windows
- tauri-playwright added this in PR #1 (defaults to `"main"`, configurable)
- Currently no way to configure which window `browser.tauri.execute()` targets

### Applies to: Tauri only

Electron already has multi-window support via Puppeteer's target tracking and `browser.electron.windowHandle`.

### Design

```typescript
// Configuration
{
  'wdio:tauriServiceOptions': {
    windowLabel: 'main',  // Default, matches Tauri's default window label
  },
}

// Runtime API (future)
await browser.tauri.switchWindow('settings');
```

### Implementation Steps

1. **Add `windowLabel` to `TauriServiceOptions`** (default: `'main'`)
2. **Pass label to embedded plugin** when executing commands
3. **Add `browser.tauri.switchWindow(label)`** command for dynamic switching
4. **Update direct eval channel** (Improvement 2) to target specific window
5. **Test with multi-window fixture app**

### Effort: Small (1-2 days for basic support)

---

## Improvement 4: Native Screenshot Capture

### What

Capture pixel-perfect screenshots of the native application window including title bar and window chrome, using platform-specific APIs instead of WebDriver's viewport-only screenshot.

### Why

- WebDriver screenshots only capture the webview content
- Native screenshots include title bar, native menus, and window decorations
- More useful for visual regression testing of desktop apps
- tauri-playwright demonstrates this with CoreGraphics FFI on macOS

### Applies to: Tauri + Electron

Both are desktop apps where native window chrome is part of the user experience.

### Design

| Platform | API | Implementation |
|----------|-----|----------------|
| macOS | CoreGraphics (`CGWindowListCreateImage`) | Rust FFI in Tauri plugin; Node.js FFI or `screencapture` CLI for Electron |
| Windows | DWM (`DwmGetWindowAttribute` + `PrintWindow`) | Rust FFI or Win32 bindings |
| Linux | X11 (`XGetImage`) / Wayland (portal API) | Platform-dependent, complex |

### Implementation Steps

1. **macOS first**: Add `native_screenshot(pid)` to Tauri embedded plugin using CoreGraphics
2. **Expose as `browser.tauri.nativeScreenshot()`** / `browser.electron.nativeScreenshot()`
3. **Windows**: Add Win32 DWM-based capture
4. **Linux**: Evaluate feasibility (X11 vs Wayland split makes this harder)
5. **Integration**: Auto-attach native screenshots on test failure (like tauri-playwright does)

### Effort: Medium (platform-specific, incremental rollout)
### Priority: Low — pursue when there's user demand

---

## Improvement 5: Audit JS String Interpolation

### What

Audit all JavaScript string interpolation in the Tauri and Electron plugins/services for proper JSON escaping.

### Why

- tauri-playwright PR #1 review flagged unsafe string interpolation into JS string literals
- The fix is simple: use `serde_json::to_string()` (Rust) or `JSON.stringify()` (JS) for any value going into a JS string
- Manual `.replace()` calls for escaping are error-prone (miss edge cases like newlines, tabs, unicode)

### Applies to: Tauri + Electron

Both services inject JavaScript into app contexts.

### Specific Areas to Audit

**Tauri:**
- `tauri-plugin-wdio-webdriver` — any Rust code generating JS strings
- `tauri-plugin/guest-js/` — mock injection and invoke interception
- `tauri-service/src/mock.ts` — mock implementation serialization (`fn.toString()`)

**Electron:**
- `electron-cdp-bridge/src/bridge.ts` — initialization script injection
- `electron-service/src/mock.ts` — mock implementation serialization
- `electron-service/src/commands/executeCdp.ts` — function parsing and argument passing

### Implementation Steps

1. **Grep for string interpolation patterns** in Rust (`format!` with JS) and TypeScript (template literals with JS)
2. **Replace manual escaping** with `serde_json::to_string()` / `JSON.stringify()`
3. **Add test cases** for edge cases: strings with quotes, newlines, unicode, backslashes
4. **Document the pattern** in coding standards

### Effort: Small (1-2 days)

---

## Improvement 6: Simplified IPC Mock Serialization

### What

Adopt tauri-playwright's pattern of serializing mock handlers as JavaScript function strings for simpler mock injection, particularly for the browser-only mode (Improvement 1).

### Why

- Current mock architecture uses a complex inner/outer sync protocol across process boundaries
- For browser-only mode, mocks run in the same browser context — no process boundary to cross
- tauri-playwright's pattern of `handler.toString()` + `ipcContext` is simpler for this use case
- Could also simplify the full integration mode by reducing sync overhead

### Applies to: Tauri + Electron (browser-only mode); potential simplification for native mode

### Design

```typescript
// Current approach (native mode): inner mock + outer mock + pull-based sync
const mock = await browser.tauri.mock('greet');
mock.mockImplementation((args) => `Hello, ${args.name}!`);
// ... test runs, app calls greet ...
await mock.update(); // Pull inner state to outer mock
expect(mock).toHaveBeenCalledWith({ name: 'World' });

// New approach (browser-only mode): single mock, no sync needed
const mock = await browser.tauri.mock('greet', (args) => `Hello, ${args.name}!`);
// ... test runs, mock intercepts invoke() directly in browser ...
expect(mock).toHaveBeenCalledWith({ name: 'World' }); // No update() needed
```

### Implementation Steps

1. **Extend `@wdio/native-spy`** with `createIpcInterceptor(framework, mocks)`:
   - Serializes mock handlers via `fn.toString()`
   - Generates injection script for Tauri or Electron IPC bridge
   - Returns mock registry compatible with `ServiceMockStore`
2. **Wire into browser-only mode** (Improvement 1)
3. **Evaluate for native mode**: Could the simplified pattern work when the app is real? (Partial — works for frontend-intercepted commands, not for backend-only APIs)

### Effort: Medium (tied to Improvement 1)

---

## Implementation Order

### Phase A: Quick Wins (1-2 weeks)

```
5. Audit JS string interpolation ──→ Both services
3. Multi-window label config ──────→ Tauri service
```

These are independent, low-risk, and immediately valuable.

### Phase B: Foundation (3-4 weeks)

```
2. Direct WebView eval channel ────→ Tauri embedded plugin
```

This is the architectural prerequisite for faster `execute()` and better mock sync. Build this before browser-only mode since the patterns inform the mock layer design.

### Phase C: Browser-Only Mode (4-6 weeks)

```
6. IPC mock serialization ─────┐
                                ├──→ @wdio/native-spy (shared)
1. Browser-only test mode ─────┘
   ├── Tauri browser mode
   └── Electron browser mode
```

These are tightly coupled. Build the mock serialization layer first, then wire it into both services.

### Phase D: Native Screenshots (future, on demand)

```
4. Native screenshot capture ──→ Both services (macOS first)
```

Pursue when users request it or when visual regression testing becomes a priority.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Browser-only mode gives false confidence (tests pass but real app breaks) | Document clearly as "frontend-focused" mode; recommend running full integration tests in CI |
| Direct eval channel adds complexity (two communication paths) | Clear boundaries: WebDriver for DOM, direct eval for Tauri commands and mocks |
| Multi-window support is hard to test without multi-window fixture apps | Create a minimal multi-window Tauri fixture app in `fixtures/e2e-apps/` |
| IPC mock serialization loses closures (`fn.toString()` limitation) | Document limitation; provide `ipcContext` escape hatch for shared state |
| Native screenshots are platform-specific maintenance burden | Start macOS-only; add platforms incrementally based on demand |

---

## Alignment with Existing Architecture

All improvements follow existing patterns documented in `agent-os/standards/`:

- **Service architecture**: Launcher/Worker split maintained; browser-only mode just changes what the launcher starts
- **Mock architecture**: Inner/outer pattern preserved for native mode; browser-only mode uses simplified single-context mocks
- **Port allocation**: PortManager used for any new ports (direct eval channel)
- **Error handling**: Result type pattern for all new operations
- **Cross-platform**: Platform checks before native screenshot calls; fallbacks documented
