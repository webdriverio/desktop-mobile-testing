# @wdio/native-utils

Framework-agnostic utilities for WebdriverIO native desktop and mobile services.

## Overview

This package provides reusable utilities for building WebdriverIO services that test native desktop and mobile applications. It extracts common patterns from the Electron service to enable code reuse across Flutter, Neutralino, and Tauri services.

## Features

- **Configuration Reading**: Multi-format config parser (JSON5, YAML, TOML, JS/TS)
- **Logging**: Scoped logger factory integrating with @wdio/logger
- **Platform Detection**: Cross-platform utilities and platform-specific helpers
- **Binary Detection**: Abstract framework for detecting application binaries
- **Service Lifecycle**: Base classes for launcher and service implementations
- **Window Management**: Window handle tracking and focus management
- **Testing Utilities**: Mock helpers and fixtures for service testing

## Installation

```bash
pnpm add @wdio/native-utils
```

## Usage

### Configuration Reading

```typescript
import { ConfigReader } from '@wdio/native-utils/configuration';

const reader = new ConfigReader({
  filePatterns: ['app.config.json', '.apprc'],
  schema: myConfigSchema, // Optional Zod schema
});

const config = await reader.read(projectRoot);
```

### Logging

```typescript
import { LoggerFactory } from '@wdio/native-utils/logging';

const logger = LoggerFactory.create({
  scope: 'my-service',
  area: 'launcher',
});

logger.info('Service started');
logger.debug('Debug information');
```

### Platform Utilities

```typescript
import { PlatformUtils } from '@wdio/native-utils/platform';

const platform = PlatformUtils.getPlatform(); // 'darwin' | 'win32' | 'linux'
const displayName = PlatformUtils.getPlatformDisplayName(); // 'macOS' | 'Windows' | 'Linux'
const extension = PlatformUtils.getBinaryExtension(); // '.exe' | '.app' | ''
```

### Binary Detection

```typescript
import { BinaryDetector } from '@wdio/native-utils/binary-detection';

class MyAppDetector extends BinaryDetector {
  protected async generatePossiblePaths(options) {
    // Framework-specific path generation
    return {
      success: true,
      paths: ['/path/to/app1', '/path/to/app2'],
      errors: [],
    };
  }
}

const detector = new MyAppDetector();
const result = await detector.detectBinaryPath({ projectRoot: '/project' });
```

### Service Lifecycle

```typescript
import { BaseLauncher, BaseService } from '@wdio/native-utils/service-lifecycle';

class MyLauncher extends BaseLauncher {
  protected async prepare(config, capabilities) {
    // Framework-specific preparation
  }
}

class MyService extends BaseService {
  protected async initialize(caps, specs, browser) {
    // Framework-specific initialization
  }

  protected async registerCommands() {
    this.registerBrowserCommand('myCommand', () => {
      // Command implementation
    });
  }
}
```

## Documentation

- [API Documentation](./docs/api.md)
- [Extension Guide](./docs/extension-guide.md)
- [Examples](./docs/examples.md)

## License

MIT

