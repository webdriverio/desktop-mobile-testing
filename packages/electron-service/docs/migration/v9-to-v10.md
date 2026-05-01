# Migration Guide: v9 → v10

This guide highlights the changes when moving from v9 to v10 and actions needed for smooth upgrades.

## Package Name Change

The package has been renamed from `wdio-electron-service` to the scoped `@wdio/electron-service` to align with the official WebdriverIO ecosystem.

### Update Installation

**Uninstall the old package:**

```bash
npm uninstall wdio-electron-service
```

**Install the new scoped package:**

```bash
npm install --save-dev @wdio/electron-service
```

Or use your package manager of choice (pnpm, yarn, etc.).

### Update Configuration

**No changes needed** - Your WDIO configuration will continue to work as-is.

```ts
export const config = {
  services: ['electron'],
  // ...
};
```

WebdriverIO automatically resolves the `'electron'` service name to the correct package (`wdio-electron-service` in v9, `@wdio/electron-service` in v10).

### Update Imports

If you're using standalone mode or importing types/utilities from the package, update your import paths:

**Before (v9):**

```ts
import { startWdioSession, cleanupWdioSession } from 'wdio-electron-service';
import type { ElectronServiceCapabilities } from 'wdio-electron-service';
```

**After (v10):**

```ts
import { startWdioSession, cleanupWdioSession } from '@wdio/electron-service';
import type { ElectronServiceCapabilities } from '@wdio/electron-service';
```

## New Features (Optional)

v10 introduces several new capabilities that you may want to adopt:

### Console Log Capture

You can now capture console output from both main and renderer processes:

```ts
export const config = {
  services: [
    ['electron', {
      captureMainProcessLogs: true,
      captureRendererLogs: true,
      mainProcessLogLevel: 'info',
      rendererLogLevel: 'info'
    }]
  ]
};
```

Main process capture requires the `EnableNodeCliInspectArguments` Electron fuse to be enabled. Renderer capture works independently. See [Debugging documentation](../debugging.md#electron-log-capture) for details.

### Class Mocking

`browser.electron.mock()` now accepts a class name (no function name) to mock entire Electron classes such as `Tray`, `BrowserWindow`, or `Menu`. Constructor calls are tracked via the special `__constructor` mock, and instance methods are individually mockable:

```ts
const mockTray = await browser.electron.mock('Tray');

await browser.electron.execute((electron) => {
  const tray = new electron.Tray('/path/to/icon.png');
  tray.setTitle('My App');
});

expect(mockTray.__constructor).toHaveBeenCalledWith('/path/to/icon.png');
expect(mockTray.setTitle).toHaveBeenCalledWith('My App');
```

See [API Reference – Electron Class Mock](../api-reference.md#electron-class-mock).

### Per-API Mock Management

`clearAllMocks()`, `resetAllMocks()`, and `restoreAllMocks()` now accept an optional `apiName` argument to scope the operation to a single Electron API:

```ts
const mockSetName = await browser.electron.mock('app', 'setName');
const mockWriteText = await browser.electron.mock('clipboard', 'writeText');

// Clear only the `app` mocks; clipboard mocks are untouched.
await browser.electron.clearAllMocks('app');
```

### `apparmorAutoInstall` (Linux)

A new option to control automatic installation of AppArmor profiles on Ubuntu 24.04+ and other AppArmor-enabled distributions, where unprivileged user namespace restrictions otherwise block Electron from starting:

```ts
services: [
  ['electron', {
    // false (default) | true | 'sudo'
    apparmorAutoInstall: 'sudo'
  }]
]
```

See [`apparmorAutoInstall`](../configuration.md#apparmorautoinstall) for details.

### `electronBuilderConfig`

Point the service at a custom electron-builder config file when your project keeps multiple build configurations side-by-side (e.g., staging vs production):

```ts
services: [
  ['electron', {
    electronBuilderConfig: 'config/electron-builder-staging.config.js'
  }]
]
```

The service resolves any `extends` chain to determine the binary output path. See [`electronBuilderConfig`](../configuration.md#electronbuilderconfig).

## Breaking Changes

### `createElectronCapabilities()` API change

The `createElectronCapabilities()` helper now accepts a single `ElectronServiceOptions` object instead of positional arguments.

**Before (v9):**

```ts
const caps = createElectronCapabilities('/path/to/binary', undefined, {
  appArgs: ['--headless'],
});
const browser = await startWdioSession([caps]);
```

**After (v10):**

```ts
const caps = createElectronCapabilities({
  appBinaryPath: '/path/to/binary',
  appArgs: ['--headless'],
});
const browser = await startWdioSession([caps]);
```

The function now returns an `ElectronStandaloneCapability` (a single object) instead of `ElectronServiceCapabilities` (a union type). All `ElectronServiceOptions` fields are accepted directly, including `captureMainProcessLogs`, `logDir`, `clearMocks`, etc.

## Verification

After updating, verify your migration:

1. **Check your package.json** - Should list `@wdio/electron-service` instead of `wdio-electron-service`
2. **Check your wdio.conf.ts** - Should use `'electron'` or `'@wdio/electron-service'` in services
3. **Run your tests** - Everything should work as before

If you encounter issues, check the [Common Issues](../common-issues.md) documentation.
