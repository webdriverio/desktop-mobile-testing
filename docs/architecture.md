# Architecture Overview

This document describes the architecture of the WebdriverIO Desktop & Mobile monorepo.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WebdriverIO Test Runner                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│   @wdio/electron-service  │   │   @wdio/tauri-service     │
│   (Electron Testing)      │   │   (Tauri Testing)         │
└───────────────────────────┘   └───────────────────────────┘
            │                              │
            ▼                              ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│  @wdio/electron-cdp-bridge│   │   @wdio/tauri-plugin      │
│  (Chrome DevTools)        │   │   (Backend Access)        │
└───────────────────────────┘   └───────────────────────────┘
            │                              │
            ▼                              ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│      Chromedriver         │   │      tauri-driver         │
│      (WebDriver)          │   │      (WebDriver)          │
└───────────────────────────┘   └───────────────────────────┘
            │                              │
            ▼                              ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│   Electron Application    │   │   Tauri Application       │
└───────────────────────────┘   └───────────────────────────┘
```

## Package Responsibilities

### Service Packages

| Package | Responsibility |
|---------|---------------|
| `@wdio/electron-service` | WebdriverIO service for Electron apps |
| `@wdio/tauri-service` | WebdriverIO service for Tauri apps |

### Bridge/Plugin Packages

| Package | Responsibility |
|---------|---------------|
| `@wdio/electron-cdp-bridge` | Chrome DevTools Protocol bridge for main process access |
| `@wdio/tauri-plugin` | Tauri v2 plugin for backend command invocation |

### Shared Packages

| Package | Responsibility |
|---------|---------------|
| `@wdio/native-utils` | Cross-platform utilities (logging, binary detection) |
| `@wdio/native-types` | Shared TypeScript type definitions |
| `@wdio/native-spy` | Spy utilities for mocking |
| `@wdio/bundler` | Build tooling for package compilation |

## Service Architecture Pattern

All WDIO services follow a consistent architecture:

### Launcher (`launcher.ts`)

Responsible for driver process lifecycle:

```
┌─────────────────────────────────────────────┐
│                  Launcher                    │
├─────────────────────────────────────────────┤
│  • Driver discovery/installation            │
│  • Process spawning (spawn, ports, args)    │
│  • Startup detection                        │
│  • Graceful shutdown (SIGTERM → SIGKILL)    │
│  • Multiremote coordination                 │
│  • Per-worker instance management           │
└─────────────────────────────────────────────┘
```

**Lifecycle Hooks:**
- `onPrepare()` - Start drivers before tests
- `onWorkerStart()` - Start driver for specific worker
- `onComplete()` - Cleanup drivers after tests
- `onWorkerEnd()` - Cleanup driver for specific worker

### Service (`service.ts`)

Responsible for WebdriverIO integration:

```
┌─────────────────────────────────────────────┐
│                  Service                     │
├─────────────────────────────────────────────┤
│  • Browser capability configuration         │
│  • API injection (mock, window, etc.)       │
│  • Log forwarding setup                     │
│  • Plugin initialization                    │
└─────────────────────────────────────────────┘
```

## Driver Process Management

### Process Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Start   │───▶│  Running │───▶│ Stopping │───▶│  Stopped │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │
     │               │               │
     ▼               ▼               ▼
  Port          Health          SIGTERM
Allocation     Checks          Timeout
                    │               │
                    ▼               ▼
               Startup        SIGKILL if
              Detection      not stopped
```

### Port Management

- Dynamic port allocation using `get-port`
- Separate ports for WebDriver and native driver
- Port conflict detection and retry
- Platform-specific port handling

## Log Forwarding Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Application Under Test                   │
├──────────────────────────────────────────────────────────────┤
│  Backend Logs (Rust/Node)  │  Frontend Logs (Browser)       │
└──────────────┬─────────────┴──────────────┬─────────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────────────┐  ┌────────────────────────────┐
│       stdout/stderr          │  │     console API            │
│       (driver process)       │  │     (browser context)      │
└──────────────┬───────────────┘  └──────────────┬─────────────┘
               │                                 │
               ▼                                 ▼
┌──────────────────────────────┐  ┌────────────────────────────┐
│       Log Parser             │  │     Console Wrapper        │
│       (parseLogLine)         │  │     (intercept logs)       │
└──────────────┬───────────────┘  └──────────────┬─────────────┘
               │                                 │
               └────────────┬────────────────────┘
                            ▼
              ┌──────────────────────────────┐
              │     Log Forwarder            │
              │     (forwardLog)             │
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │     WDIO Logger              │
              │     (per-instance output)    │
              └──────────────────────────────┘
```

## Multiremote Architecture

Supports running multiple browser instances simultaneously:

```
┌─────────────────────────────────────────────────────────────┐
│                    WebdriverIO Multiremote                   │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
   ┌────────────┐      ┌────────────┐      ┌────────────┐
   │ Instance A │      │ Instance B │      │ Instance C │
   │ (driver 1) │      │ (driver 2) │      │ (driver 3) │
   └────────────┘      └────────────┘      └────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
   ┌────────────┐      ┌────────────┐      ┌────────────┐
   │ Port 4444  │      │ Port 4446  │      │ Port 4448  │
   │ App A      │      │ App B      │      │ App C      │
   └────────────┘      └────────────┘      └────────────┘
```

## Electron-Specific Architecture

### CDP Bridge

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                      │
├─────────────────────────────────────────────────────────────┤
│  Main Process              │        Renderer Process        │
│  (Node.js)                 │        (Chromium)              │
└────────────┬───────────────┴───────────────┬───────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────────┐    ┌────────────────────────────┐
│     CDP Bridge             │    │     Chromedriver           │
│     (Puppeteer)            │    │     (WebDriver)            │
└────────────────────────────┘    └────────────────────────────┘
             │                               │
             │      Main Process Access      │
             │◀──────────────────────────────│
             │                               │
             ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   @wdio/electron-service                     │
└─────────────────────────────────────────────────────────────┘
```

### API Mocking

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Code                                 │
│  browser.mock('https://api.example.com/*')                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Mock Store (CDP Bridge)                      │
│  • Request interception                                      │
│  • Response stubbing                                         │
│  • Call tracking                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Network                        │
│  Intercepts and mocks HTTP requests                         │
└─────────────────────────────────────────────────────────────┘
```

## Tauri-Specific Architecture

### Plugin Communication

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Application                         │
├─────────────────────────────────────────────────────────────┤
│  Backend (Rust)            │        Frontend (WebView)      │
└────────────┬───────────────┴───────────────┬───────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────────┐    ┌────────────────────────────┐
│   @wdio/tauri-plugin       │    │     tauri-driver           │
│   (Rust + JS)              │    │     (WebDriver)            │
└────────────────────────────┘    └────────────────────────────┘
             │                               │
             │      Tauri Commands           │
             │◀──────────────────────────────│
             │                               │
             ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   @wdio/tauri-service                        │
└─────────────────────────────────────────────────────────────┘
```

### Backend Command Invocation

```
┌──────────────────────┐
│     Test Code        │
│  browser.invoke(...) │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   guest-js/index.ts  │
│   (intercept invoke) │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   tauri-plugin       │
│   (Rust backend)     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Application        │
│   Command Handler    │
└──────────────────────┘
```

## Build Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                      Source Files                            │
│                    (TypeScript ESM)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript Compiler                       │
│              tsc -p tsconfig.json (ESM)                      │
│              tsc -p tsconfig.cjs.json (CJS)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Output                                 │
│  dist/esm/              │        dist/cjs/                   │
│  (ES Modules)           │        (CommonJS)                  │
└─────────────────────────┴───────────────────────────────────┘
```

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Test Types                             │
├─────────────────────────────────────────────────────────────┤
│  Unit Tests        │  Integration Tests   │  E2E Tests      │
│  (Vitest)          │  (Vitest)            │  (WebdriverIO)  │
│  test/*.spec.ts    │  test/integration/   │  e2e/test/      │
├────────────────────┼──────────────────────┼─────────────────┤
│  Pure logic        │  Process management  │  Full app       │
│  Mocked deps       │  Real subprocesses   │  Built apps     │
│  Fast              │  Port isolation      │  Cross-platform │
│  No build needed   │  Requires build      │  CI matrix      │
└────────────────────┴──────────────────────┴─────────────────┘
```
