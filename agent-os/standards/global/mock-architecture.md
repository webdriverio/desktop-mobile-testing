# Mock Architecture: Inner/Outer Pattern

Mocks span two process boundaries: the **app context** (Electron main process or browser window) and the **test context** (WDIO worker). This requires a dual-mock architecture.

## Architecture
```
Test Process (WDIO Worker)              App Process (Electron/Tauri)
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  Outer Mock (vitest-compat)  │    │  Inner Mock (@wdio/native-spy)│
│  - assertions/matchers       │    │  - intercepts real API calls  │
│  - .mock.calls (for tests)   │ <── │  - tracks calls internally    │
└──────────────────────────────┘    └──────────────────────────────┘
          update()                    (one-way sync: inner → outer)
```

## Key Concepts
- **Inner mock** runs inside app, created via `@wdio/native-spy` (vitest can't be bundled there)
- **Outer mock** runs in test process, used for assertions
- `update()` syncs call data from inner to outer via `JSON.parse(JSON.stringify(...))`
- JSON serialization is required due to CDP/WebDriver process boundary
- Sync is **one-directional**: inner call data → outer mock
- `mockImplementation`/`mockReturnValue` methods push config from outer → inner

## Mock Methods (all async)
Every mock method operates on **both** inner and outer:
- `mockImplementation(fn)` — serializes function string to inner, sets on outer
- `mockReturnValue(value)` — sets on inner via execute, sets on outer
- `mockClear()` — clears both inner and outer call history
- `mockReset()` — resets both implementations and clears history
- `mockRestore()` — restores original API in inner, clears outer

## Auto-Update Trigger
Element commands (`click`, `doubleClick`, `setValue`, `clearValue`) trigger `updateAllMocks()` to sync call data after DOM interactions.
