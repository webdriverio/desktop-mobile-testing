# Architecture Overview

This document describes the architecture of the WebdriverIO Desktop & Mobile monorepo.

## High-Level Architecture

```
+---------------------------------------------------------------------+
|                        WebdriverIO Test Runner                      |
+---------------------------------------------------------------------+
                                 |
                     +-----------+-----------+
                     |                       |
                     v                       v
+-----------------------------+   +-----------------------------+
|   @wdio/electron-service    |   |   @wdio/tauri-service       |
|   (Electron Testing)        |   |   (Tauri Testing)           |
+-----------------------------+   +-----------------------------+
              |                              |
              v                              v
+-----------------------------+   +-----------------------------+
|  @wdio/electron-cdp-bridge  |   |   @wdio/tauri-plugin        |
|  (Chrome DevTools)          |   |   (Execute, Mock, Logs)     |
+-----------------------------+   +-----------------------------+
              |                              |
              v                    +---------+---------+
+-----------------------------+    |         |         |
|      Chromedriver           |    v         v         v
|      (WebDriver)            |  Embedded  Official  CrabNebula
+-----------------------------+  (in-app)  (tauri-   (paid)
              |                   server)   driver)
              v                    |         |         |
+-----------------------------+    +---------+---------+
|   Electron Application      |              v
+-----------------------------+   +-----------------------------+
                                  |   Tauri Application         |
                                  +-----------------------------+
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

Runs in the main process (no `browser` access). Responsible for:
- Driver discovery/installation
- Process spawning (ports, args, env)
- Startup detection and health checks
- Graceful shutdown (SIGTERM → SIGKILL)
- Per-worker instance management

**Hooks:** `onPrepare`, `onWorkerStart`, `onWorkerEnd`, `onComplete`

### Service (`service.ts`)

Runs in the worker process (receives `browser` via `before` hook). Responsible for:
- API injection (`browser.tauri.*`, `browser.electron.*`)
- Mock lifecycle management
- Log forwarding setup
- Plugin initialization

**Hooks:** `before`, `beforeTest`, `beforeCommand`, `after`, `afterSession`

## Log Forwarding Architecture

```
+---------------------------------------------------------------------+
|                      Application Under Test                         |
+---------------------------------------------------------------------+
|  Backend Logs (Rust/Node)  |  Frontend Logs (Browser)               |
+----------------+------------+----------------+----------------------+
                 |                           |
                 v                           v
+-------------------------+  +-------------------------------------+
|       stdout/stderr     |  |             Console API             |
|       (driver process)  |  |           (browser context)         |
+-------------------------+  +-------------------------------------+
                 |                           |
                 v                           v
+-------------------------+  +-------------------------------------+
|       Log Parser        |  |          Console Wrapper            |
|       (parseLogLine)    |  |          (intercept logs)           |
+-------------------------+  +-------------------------------------+
                 |                           |
                 +------------+--------------+
                              v
                  +-------------------------+
                  |      Log Forwarder      |
                  |      (forwardLog)       |
                  +------------+------------+
                               |
                               v
                  +-------------------------+
                  |      WDIO Logger        |
                  |  (per-instance output)  |
                  +-------------------------+
```

## Electron-Specific Architecture

### CDP Bridge

```
+---------------------------------------------------------------------+
|                    Electron Application                             |
+---------------------------------------------------------------------+
|  Main Process              |        Renderer Process                |
|  (Node.js)                 |        (Chromium)                      |
+----------------+-----------+----------------+-----------------------+
                 |                          |
                 v                          v
+-------------------------+    +------------------------------------+
|     CDP Bridge          |    |          Chromedriver              |
|     (Puppeteer)         |    |          (WebDriver)               |
+-------------------------+    +------------------------------------+
                 |                          |
                 |      Main Process Access |
                 |<-------------------------|
                 |                          |
                 v                          v
+---------------------------------------------------------------------+
|                   @wdio/electron-service                            |
+---------------------------------------------------------------------+
```

## Tauri-Specific Architecture

### Driver Providers

```
+---------------------------------------------------------------------+
|                   @wdio/tauri-service                               |
+-------------------------+-------------------------------------------+
                           |
           +---------------+---------------+
           v               v               v
+-----------------+ +---------------+ +---------------+
|   Embedded      | |   Official    | |  CrabNebula   |
|   (default)     | |               | |  (paid)       |
+-----------------+ +---------------+ +---------------+
| HTTP server     | | tauri-driver  | | test-runner   |
| inside app via  | | → native      | | -backend      |
| tauri-plugin-   | |   driver      | |               |
| wdio-webdriver  | | (WebKitGTK,   | |               |
|                 | |  msedgedriver)| |               |
+-----------------+ +---------------+ +---------------+
```

### Plugin Communication

```
+---------------------------------------------------------------------+
|                    Tauri Application                                |
+---------------------------------------------------------------------+
|  Backend (Rust)            |        Frontend (WebView)              |
|  tauri-plugin-wdio         |        @wdio/tauri-plugin              |
|  (execute, log commands)   |        (mock interception,             |
|                            |         console forwarding)            |
+----------------+-----------+----------------+-----------------------+
                 |      Tauri invoke IPC      |
                 |<---------------------------|
                 |                            |
                 v                            v
+---------------------------------------------------------------------+
|                   @wdio/tauri-service                               |
|        browser.tauri.execute(), mock(), triggerDeeplink()           |
+---------------------------------------------------------------------+
```
