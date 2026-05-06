# Browser Mode

Browser mode lets you test your Tauri frontend UI in plain Chrome against a running Vite dev server — no Tauri binary, no tauri-driver, no WebKitWebDriver or msedgedriver. Tauri commands are intercepted at the `window.__TAURI_INTERNALS__.invoke()` JavaScript boundary in the renderer, so you can mock individual commands and assert on call arguments just like in native mode.

## Overview

### What Is It?

In normal (`native`) mode the service launches your compiled Tauri app, drives it via tauri-driver and a platform WebDriver, and communicates with the backend through the plugin bridge. Browser mode replaces all of that with a standard Chrome session: it sets `browserName` to `'chrome'`, navigates to your dev server URL, and injects a lightweight script that patches `window.__TAURI_INTERNALS__.invoke` so your Tauri commands can be intercepted in tests.

### Why Use It?

- **No build step needed** — point the service at `vite dev` and start testing immediately.
- **Fast feedback** — no Tauri startup, no Rust compilation, no driver negotiation.
- **Standard browser devtools** — Chrome DevTools and HMR work as normal during development.

### When to Use It

Browser mode is the right choice when your tests are renderer-focused: asserting UI state, verifying that components call the correct Tauri commands with the right arguments, or checking that the renderer handles mock responses correctly.

It is **not** suitable when your tests need to:

- Call `browser.tauri.execute()` to run code with access to the Tauri plugin bridge
- Test window management with `browser.tauri.switchWindow()` or `browser.tauri.listWindows()`
- Use `browser.tauri.triggerDeeplink()`
- Assert on real command round-trips to a running Rust backend

For those scenarios use native mode (the default).

## Setup

### 1. Start Your Dev Server

Browser mode requires a running Vite dev server. Tauri's default port is `1420`:

```bash
vite dev
# or: pnpm tauri dev (starts Vite and the Tauri binary; only Vite is needed for browser mode)
```

### 2. Configure the Service

Set `mode: 'browser'` and provide `devServerUrl` in your WDIO configuration. No `appBinaryPath`, `tauri:options`, or driver config is needed.

_`wdio.conf.ts`_

```ts
export const config = {
  services: ['@wdio/tauri-service'],
  capabilities: [
    {
      browserName: 'tauri',
      'wdio:tauriServiceOptions': {
        mode: 'browser',
        devServerUrl: 'http://localhost:1420',
      },
    },
  ],
};
```

You can also set `mode` and `devServerUrl` at the global service level so all capabilities inherit them:

```ts
export const config = {
  services: [
    [
      '@wdio/tauri-service',
      {
        mode: 'browser',
        devServerUrl: 'http://localhost:1420',
      },
    ],
  ],
  capabilities: [
    { browserName: 'tauri' },
  ],
};
```

Capability-level options take precedence over service-level ones. All capabilities in a session must use the same mode; mixing `'native'` and `'browser'` across capabilities throws a `SevereServiceError` at startup.

## IPC Mocking

### How It Works

When the session starts, the service injects a script into the page that:

1. Creates `window.__wdio_mocks__` — a registry of per-command mock functions.
2. Patches `window.__TAURI_INTERNALS__.invoke` to look up `window.__wdio_mocks__[command]` and call it; throws if the command has no registered mock.
3. Stubs `window.__TAURI_INTERNALS__.transformCallback` and related internals as no-ops where applicable.

The injection script runs again after every `browser.url()` navigation because a page load wipes `window` state.

### Mocking a Command

```ts
// In your test
const mockReadFile = await browser.tauri.mock('read_file');
await mockReadFile.mockResolvedValue('mocked file content');
```

The command name must match the string your frontend passes to `invoke()`:

```ts
// In your renderer code (e.g., via @tauri-apps/api/core)
import { invoke } from '@tauri-apps/api/core';
const content = await invoke('read_file', { path: '/some/file' });
```

### Asserting on Calls

After triggering the relevant UI action, call `update()` to sync call data from the browser-side spy to the outer mock object, then assert:

```ts
await $('button#load-file').click(); // triggers invoke('read_file', ...)

await mockReadFile.update();
expect(mockReadFile).toHaveBeenCalledTimes(1);
expect(mockReadFile.mock.calls[0]).toEqual([{ path: '/some/file' }]);
```

Element commands (`click`, `doubleClick`, `setValue`, `clearValue`) trigger `update()` automatically on all active mocks, so you often don't need to call it explicitly after those interactions.

You can also trigger a command directly from the test without a UI interaction:

```ts
await browser.execute(() => window.__TAURI_INTERNALS__.invoke('read_file', { path: '/test' }));
await mockReadFile.update();
expect(mockReadFile).toHaveBeenCalledTimes(1);
```

### Setting Implementations

All standard mock methods are available:

```ts
// Return a fixed value
await mockReadFile.mockReturnValue('file content');

// Resolve a promise (for async commands)
await mockReadFile.mockResolvedValue('file content');

// Use a function for dynamic responses
await mockReadFile.mockImplementation((args) => {
  return `content of ${args.path}`;
});

// Respond differently on the first call, then fall back
await mockReadFile.mockResolvedValueOnce('first call content');
await mockReadFile.mockResolvedValue('default content');
```

### Restoring a Mock

`mockRestore()` deregisters the command from `window.__wdio_mocks__`. After restoring, any `invoke` call to that command will throw the "unmocked command" error.

```ts
await mockReadFile.mockRestore();
```

## Mock Lifecycle Across Tests

### `mock(command)` Is Idempotent

Calling `browser.tauri.mock(command)` multiple times for the same command is safe. The service returns the existing mock if the browser-side entry is still live, or silently re-registers it (without resetting call history or implementation) if a navigation wiped `window.__wdio_mocks__`.

This means it is safe to call `mock(command)` in both `beforeAll` and `beforeEach`:

```ts
describe('File panel', () => {
  let mockReadFile: TauriMock;

  beforeAll(async () => {
    mockReadFile = await browser.tauri.mock('read_file');
    await mockReadFile.mockResolvedValue('default content');
  });

  beforeEach(async () => {
    // Safe to call again — returns the same mock, implementation is preserved
    mockReadFile = await browser.tauri.mock('read_file');
    await mockReadFile.mockClear(); // Reset call history only
  });

  it('displays file content', async () => {
    await $('button#load-file').click();
    await mockReadFile.update();
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });
});
```

### Clearing vs Resetting

| Method | Effect |
|--------|--------|
| `mockClear()` | Clears `.mock.calls`, `.mock.results`, `.mock.invocationCallOrder`. Implementation unchanged. |
| `mockReset()` | Clears history **and** removes the implementation (returns `undefined` on next call). |
| `mockRestore()` | Removes the mock entirely from `window.__wdio_mocks__`. |

Use `mockClear()` in `beforeEach` when you want a clean call history but want to keep the implementation set up in `beforeAll`.

## Navigation

`browser.url()` is patched by the service to re-run the IPC injection script after every navigation. This re-creates `window.__wdio_mocks__` (as an empty object) and patches `window.__TAURI_INTERNALS__.invoke` again, so existing mock handles remain valid — calling `mock(command)` after navigation re-registers the browser-side entry on demand.

```ts
it('preserves mock handles across navigation', async () => {
  const mockGetConfig = await browser.tauri.mock('get_config');
  await mockGetConfig.mockResolvedValue({ theme: 'dark' });

  // Navigate to another route
  await browser.url('http://localhost:1420/settings');

  // Re-register and use — same outer mock object, fresh browser-side spy
  await browser.tauri.mock('get_config');
  await mockGetConfig.mockResolvedValue({ theme: 'dark' }); // Re-set implementation
  await $('button#load-config').click();
  await mockGetConfig.update();
  expect(mockGetConfig).toHaveBeenCalledTimes(1);
});
```

### Timing Caveat

The injection script runs after `browser.url()` resolves (document `readyState` is `complete`). Any `invoke()` calls your app makes during module-level initialization — before the first `DOMContentLoaded` — happen before the script is injected and will not be intercepted.

**Workaround:** Create a Vite plugin that imports the injection script as a top-level module in your dev build, so it runs before any app code.

## Limitations

| Feature | Browser Mode |
|---------|-------------|
| `browser.tauri.execute()` | Throws — no Tauri backend or plugin bridge |
| `browser.tauri.triggerDeeplink()` | Throws — no Tauri process |
| `browser.tauri.switchWindow()` | Throws — multi-window requires a native Tauri app |
| `browser.tauri.listWindows()` | Throws — same reason as `switchWindow()` |
| Backend log capture (`captureBackendLogs`) | Not available — no Rust process |
| Frontend log capture (`captureFrontendLogs`) | Available — Chrome session, standard console capture |
| Automatic window focus management | Disabled — standard Chrome window switching applies |
| `window.__TAURI_INTERNALS__.invoke` event listeners | Not intercepted — fire-and-forget listeners are no-ops |

## Multiremote

Each named multiremote instance gets its own isolated mock registry. Mocking the same command on two instances is safe; they do not share `window.__wdio_mocks__`.

_`wdio.conf.ts`_

```ts
export const config = {
  services: [['@wdio/tauri-service', { mode: 'browser' }]],
  capabilities: {
    app1: {
      capabilities: {
        browserName: 'tauri',
        'wdio:tauriServiceOptions': { devServerUrl: 'http://localhost:1420' },
      },
    },
    app2: {
      capabilities: {
        browserName: 'tauri',
        'wdio:tauriServiceOptions': { devServerUrl: 'http://localhost:1420' },
      },
    },
  },
};
```

```ts
// In tests — each instance mocks independently
const mock1 = await browser.getInstance('app1').tauri.mock('read_file');
const mock2 = await browser.getInstance('app2').tauri.mock('read_file');

await mock1.mockResolvedValue('content from app1');
await mock2.mockResolvedValue('content from app2');
```

## Troubleshooting

### `"unmocked Tauri command in browser mode: <command>"`

Your renderer called `invoke(command)` before a mock was registered for that command. Call `browser.tauri.mock(command)` before the code path that triggers the command.

### Mock returns `undefined` after navigation

The browser-side mock was wiped by the navigation. Call `browser.tauri.mock(command)` again to re-register it and re-apply any implementation you need.

### App commands during startup are not intercepted

The injection script runs after page load. If your app invokes commands during module initialization, those calls happen before the script is active. See the [timing caveat](#timing-caveat) above.

### Dev server not running

The service throws a `SevereServiceError` if `devServerUrl` is missing or not a valid URL. A connection-refused error from Chrome means the dev server is not running — start Vite before launching the test suite.
