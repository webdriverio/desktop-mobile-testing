# Tauri-Playwright Analysis: Learnings for @wdio/tauri-service

**Date:** 2026-03-30

## Overview

This report analyzes the [tauri-playwright](https://github.com/srsholmes/tauri-playwright) library and its [PR #1](https://github.com/srsholmes/tauri-playwright/pull/1) to identify patterns, ideas, and improvements that could benefit `@wdio/tauri-service`.

**tauri-playwright** is a Playwright integration for Tauri apps that bypasses the standard WebDriver protocol entirely. Instead of relying on tauri-driver or msedgedriver, it embeds a Rust plugin (`tauri-plugin-playwright`) in the Tauri app that provides direct communication between test runner and webview via Unix sockets / TCP.

---

## Architectural Comparison

| Aspect | @wdio/tauri-service | tauri-playwright |
|--------|---------------------|------------------|
| **Protocol** | WebDriver (via tauri-driver/msedgedriver) | Custom socket + JS eval in webview |
| **Driver dependency** | tauri-driver (official), CrabNebula, or embedded | None — plugin is embedded |
| **Communication** | HTTP (WebDriver REST API) | Unix socket / TCP (JSON-over-newline) |
| **JS execution** | WebDriver `execute` command | Direct `WebviewWindow::eval()` (after PR #1) |
| **App plugin required** | Optional (tauri-plugin-wdio-webdriver for embedded) | Required (tauri-plugin-playwright) |
| **Assertion retries** | WebdriverIO built-in waitUntil | Custom polling matchers (100ms interval) |
| **Platform support** | Windows, macOS, Linux | macOS (full), Linux (partial), Windows (CDP fallback) |

---

## Key Ideas Worth Borrowing

### 1. Direct WebView Eval via Tauri Plugin (High Impact)

**What they do:** PR #1 replaces the HTTP polling bridge with direct `WebviewWindow::eval()` calls. The plugin injects JavaScript directly into the webview, and results return via Tauri's IPC (`invoke('plugin:playwright|pw_result', ...)`).

**Why it matters for us:** Our embedded provider already embeds a plugin in the Tauri app. We could extend this plugin to provide a direct eval channel, bypassing the WebDriver protocol for operations where it's slow or limited (e.g., Tauri command execution, mock state sync, console log capture). This wouldn't replace WebDriver — it would supplement it for Tauri-specific operations.

**Concrete opportunity:** `browser.tauri.execute()` currently goes through WebDriver's `execute` command, which has serialization overhead and protocol limitations. A direct IPC channel from the plugin could make Tauri command execution significantly faster and support richer return types.

**Risk:** Adds complexity by maintaining two communication channels. Would need clear boundaries for when to use each.

---

### 2. Three Testing Modes: Browser / Tauri / CDP (Medium Impact)

**What they do:** tauri-playwright offers three modes:
- **Browser mode**: Runs tests against the web frontend in headless Chromium with mocked Tauri IPC — no real app needed
- **Tauri mode**: Full integration with real app via socket bridge
- **CDP mode**: Direct Chrome DevTools Protocol connection (Windows WebView2)

**Why it matters:** The browser mode is the standout idea. It allows developers to write and iterate on tests rapidly without building/launching the real Tauri app. The mock IPC layer intercepts `window.__TAURI_INTERNALS__.invoke()` calls and returns configured responses.

**Concrete opportunity:** We could add a "browser-only" test mode to `@wdio/tauri-service` that:
1. Launches a regular browser (Chrome/Firefox) pointing at the Vite dev server
2. Injects a Tauri IPC mock layer that intercepts `invoke()` calls
3. Returns configured mock responses for Tauri commands

This would give developers a fast feedback loop for UI-focused tests that don't need real backend integration. Similar to our existing mock architecture but without needing the real app at all.

---

### 3. IPC Mock Injection Pattern (Medium Impact)

**What they do:** Mock handlers are serialized as JavaScript function strings and injected into the page via `addInitScript()`:

```typescript
const mocks = {
  'greet': (args) => `Hello, ${args.name}!`,
  'plugin:fs|read': () => 'file contents',
};
// Serialized and injected, intercepts invoke() at runtime
```

They also support an `ipcContext` object that makes Node.js variables available inside mock handlers.

**Why it matters:** Our current mock architecture uses inner/outer mock synchronization across process boundaries (CDP/WebDriver). The tauri-playwright approach of serializing mock handlers directly as JS functions is simpler for many use cases.

**Concrete opportunity:** For the browser-only mode described above, adopt this serialization pattern for mock injection. For the full integration mode, consider whether mock handler registration could be simplified by sending serialized functions to the plugin rather than going through the current inner/outer mock sync protocol.

---

### 4. Configurable Window Label for Multi-Window Apps (Low Effort, High Value)

**What they do:** `PluginConfig::window_label()` defaults to `"main"` but can be configured for multi-window apps.

**Why it matters:** Multi-window Tauri apps need to target specific windows for operations. Our service currently doesn't have explicit window label configuration.

**Concrete opportunity:** Add a `windowLabel` option to TauriServiceOptions that controls which webview window the service targets for Tauri-specific operations. Default to `"main"` for zero-config simplicity.

---

### 5. Native Screenshot Capture via CoreGraphics (Low Impact for Now)

**What they do:** On macOS, the plugin captures window screenshots using CoreGraphics FFI (`CGWindowListCreateImage`) — no external tools needed. Includes the native title bar, producing pixel-perfect desktop screenshots.

**Why it matters:** WebDriver screenshots only capture the webview content, not the native window chrome. Native screenshots are more useful for visual regression testing of desktop apps.

**Concrete opportunity:** If we add native screenshot support, the CoreGraphics approach (or platform equivalents) could provide better visual testing capabilities than WebDriver screenshots alone. Low priority until there's user demand.

---

### 6. Semantic Locators via JS Resolution (Low Priority)

**What they do:** Implement Playwright-style semantic locators (`getByText`, `getByRole`, `getByTestId`) by storing JS resolution expressions with each locator and executing them at action time.

**Why it matters:** WebdriverIO already has good selector support, but this pattern of deferring JS evaluation until action time (with auto-retry) is clean.

**Not actionable:** WebdriverIO's existing selector engine and `$()` / `$$()` API already cover this well. No action needed.

---

## PR #1 Specific Learnings

### Architecture Improvement: eval() > HTTP Polling

PR #1 by @vdavid replaces the HTTP polling bridge with direct `WebviewWindow::eval()`. Key wins:

| Before (polling) | After (eval) |
|---|---|
| HTTP server bound to `0.0.0.0:6275` (security risk) | No HTTP server needed |
| ~16ms poll interval + 2 HTTP round-trips | ~0ms injection + 1 IPC call |
| `new Function()` in webview (blocked by strict CSP) | Platform-level `webview.eval()` bypasses CSP |
| 57-line JS polling script injected at startup | Single line: `window.__PW_ACTIVE__ = true` |
| Command queue + pending results map | Direct eval + IPC return path |

**Takeaway for us:** If we build a direct communication channel in our embedded plugin, use `WebviewWindow::eval()` + IPC rather than an HTTP polling bridge. The PR's review comments also highlight important considerations:
- **Window readiness**: Need retry/backoff when window isn't created yet (our `startTimeout` polling handles this)
- **JSON escaping**: Use `serde_json::to_string()` for all values going into JS strings, not manual escaping
- **Tauri 2 permissions**: Any IPC command needs `build.rs`, `default.toml`, and permission schema

### CSP Fix Pattern

The PR fixes a CSP issue where `waitForFunction` used `eval()` internally. The fix embeds the expression directly into the injected script instead of double-evaluating it. If our embedded plugin ever injects JS, avoid `eval()` / `new Function()` — use direct embedding.

---

## Risks and Limitations of tauri-playwright's Approach

These are worth noting to understand where our WebDriver-based approach has advantages:

1. **Required app modification**: tauri-playwright requires adding a Rust plugin to the Tauri app, gated behind a cargo feature. Our official driver provider needs zero app changes.

2. **Limited platform support**: Native screenshots only work on macOS. Linux native capture returns "not yet supported." Windows requires CDP fallback. Our WebDriver approach works consistently across all platforms.

3. **No parallel test isolation**: Hardcoded ports (6275 for HTTP, 6274 for TCP) prevent running multiple instances. Our PortManager with `get-port` handles this cleanly.

4. **Fragile socket communication**: Newline-delimited JSON over Unix sockets is simpler but less robust than WebDriver's well-specified HTTP API with proper status codes and error types.

5. **Polling bridge latency** (pre-PR #1): The 16ms polling interval was a notable bottleneck. PR #1 fixes this, but it shows the risk of custom protocol bridges — WebDriver handles this out of the box.

6. **Security**: The HTTP server bound to `0.0.0.0:6275` (all interfaces) rather than `127.0.0.1`. PR #1 eliminates this, but it's a reminder to always bind to localhost for test infrastructure.

---

## Recommended Actions

### Short-term (Low Effort)
1. **Add `windowLabel` config option** — Simple addition to TauriServiceOptions for multi-window app support
2. **Evaluate JSON escaping in our plugin code** — Audit any JS string interpolation in tauri-plugin-wdio-webdriver for proper escaping

### Medium-term (Moderate Effort)
3. **Prototype a browser-only test mode** — Run tests against Vite dev server with mocked Tauri IPC, no real app needed. Biggest developer experience win.
4. **Add direct IPC channel to embedded plugin** — Supplement WebDriver with a direct eval channel for Tauri-specific operations (execute, mocks, logs)

### Long-term (Investigation)
5. **Native screenshot support** — Investigate CoreGraphics (macOS), DWM (Windows), and X11/Wayland (Linux) for native window capture
6. **Evaluate whether eval-based approach could replace tauri-driver dependency** — If the embedded plugin grows capable enough, it might eliminate the need for external drivers entirely for some use cases

---

## Summary

tauri-playwright takes a fundamentally different approach — embedding a custom protocol bridge inside the Tauri app rather than using the standard WebDriver ecosystem. This gives it advantages in simplicity and speed for its supported scenarios, but at the cost of requiring app modification and having weaker cross-platform support.

The most valuable ideas to borrow are:
1. **Browser-only test mode with mocked IPC** — fastest path to better developer experience
2. **Direct WebView eval via plugin** — supplement WebDriver for Tauri-specific operations
3. **Multi-window label configuration** — small but practical addition

PR #1's shift from HTTP polling to direct `WebviewWindow::eval()` validates that direct eval is the right architecture for in-app test bridges, and provides a concrete reference implementation we can learn from.
