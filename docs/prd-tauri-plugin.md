# Product Requirements Document: @wdio/tauri-plugin

## 1. Overview

### 1.1 Purpose
Create a Tauri plugin (`@wdio/tauri-plugin`) that provides a clean, standardized interface for WebDriverIO to interact with Tauri backend commands and enables API mocking capabilities for comprehensive E2E testing.

### 1.2 Background
Currently, the `@wdio/tauri-service` requires applications to manually expose `window.__TAURI__.core.invoke` globally for backend command execution. This approach:
- Requires manual setup in each test app
- Provides no built-in mocking capabilities
- Doesn't follow Tauri plugin conventions
- Lacks a clean, standardized testing interface

The Electron service provides a similar pattern with `browser.electron.execute()` and comprehensive mocking capabilities. We need equivalent functionality for Tauri that follows Tauri's plugin architecture.

### 1.3 Success Criteria
- Users can add the plugin to their Tauri app with minimal configuration
- Tests can execute backend commands via a clean `window.TauriTest.execute()` interface
- Tests can mock backend commands for isolated testing
- The interface matches the Electron service pattern for consistency
- Mock state persists across test executions within a session
- All-or-nothing mocking support (no partial mocking initially)

## 2. Goals and Objectives

### 2.1 Primary Goals
1. **Provide Clean Testing Interface**: Replace manual `window.__TAURI__.core.invoke` exposure with `window.TauriTest.execute()`
2. **Enable API Mocking**: Allow tests to mock backend commands similar to Electron service
3. **Follow Tauri Conventions**: Implement as a proper Tauri plugin, not a regular Rust crate
4. **Maintain Consistency**: Match Electron service API patterns where possible

### 2.2 Secondary Goals
1. **Simplify Setup**: Minimal configuration required to enable testing capabilities
2. **Type Safety**: Provide TypeScript definitions for the testing interface
3. **Error Handling**: Clear error messages when commands fail or mocks aren't configured
4. **Documentation**: Comprehensive guides and examples

## 3. User Stories

### 3.1 Basic Command Execution
**As a** developer writing E2E tests for a Tauri app
**I want to** execute backend commands via a clean interface
**So that** I can test backend functionality without manual API exposure

```typescript
// Before (current approach)
const result = await browser.execute(() => {
  return window.__TAURI__.core.invoke('get_platform_info');
});

// After (with plugin)
const result = await browser.execute(() => {
  return window.TauriTest.execute('get_platform_info');
});
```

### 3.2 API Mocking
**As a** developer writing E2E tests
**I want to** mock backend commands
**So that** I can test frontend behavior without actual backend dependencies

```typescript
// Mock a command
await browser.execute(() => {
  return window.TauriTest.mock('get_platform_info', 'mocked-platform');
});

// Execute command (returns mocked value)
const result = await browser.execute(() => {
  return window.TauriTest.execute('get_platform_info');
});
expect(result).toBe('mocked-platform');

// Clear mocks
await browser.execute(() => {
  return window.TauriTest.clearMocks();
});
```

### 3.3 Plugin Integration
**As a** developer setting up a Tauri app for testing
**I want to** add the plugin with minimal configuration
**So that** I can start testing quickly

```toml
# Cargo.toml
[dependencies]
tauri = { version = "2.0", features = ["devtools"] }
wdio-tauri-plugin = "0.1.0"
```

```json
// tauri.conf.json
{
  "plugins": {
    "wdio-tauri-plugin": {}
  }
}
```

## 4. Functional Requirements

### 4.1 Core Command Execution
- **FR-1**: The plugin MUST provide a `execute_command` Tauri command that accepts:
  - `command: String` - The name of the command to execute
  - `args: Vec<serde_json::Value>` - Arguments to pass to the command
- **FR-2**: The plugin MUST return command results as `Result<serde_json::Value, String>`
- **FR-3**: The plugin MUST support async Rust commands
- **FR-4**: The plugin MUST check for mock responses before executing real commands
- **FR-5**: The plugin MUST handle command execution errors gracefully

### 4.2 Mocking Interface
- **FR-6**: The plugin MUST provide a `mock_command` Tauri command that accepts:
  - `command: String` - The name of the command to mock
  - `response: serde_json::Value` - The mocked response value
- **FR-7**: The plugin MUST store mocks in a global registry (HashMap/BTreeMap)
- **FR-8**: The plugin MUST support all-or-nothing mocking (no partial mocking initially)
- **FR-9**: The plugin MUST persist mock state for the duration of the test session
- **FR-10**: The plugin MUST provide a `clear_mocks` command to reset all mocks

### 4.3 Frontend Interface
- **FR-11**: The plugin MUST generate a JavaScript file that exposes `window.TauriTest` object
- **FR-12**: The `window.TauriTest` object MUST provide:
  - `execute(command: string, ...args: any[]): Promise<any>`
  - `mock(command: string, response: any): Promise<void>`
  - `clearMocks(): Promise<void>`
- **FR-13**: The interface MUST use async/await for all operations
- **FR-14**: The interface MUST handle errors consistently

### 4.4 Plugin Integration
- **FR-15**: The plugin MUST be installable via Cargo (`cargo add wdio-tauri-plugin`)
- **FR-16**: The plugin MUST be registerable in `tauri.conf.json` plugins section
- **FR-17**: The plugin MUST generate the JavaScript interface file automatically
- **FR-18**: The plugin MUST work with Tauri v2 (no v1 support required)

## 5. Non-Functional Requirements

### 5.1 Performance
- **NFR-1**: Command execution overhead MUST be < 10ms (excluding actual command execution time)
- **NFR-2**: Mock lookup MUST be O(1) average case
- **NFR-3**: Mock storage MUST not exceed 1MB per session

### 5.2 Compatibility
- **NFR-4**: Plugin MUST support Tauri v2.0.0+
- **NFR-5**: Plugin MUST work with Windows and Linux (macOS limitation inherited from tauri-driver)
- **NFR-6**: Plugin MUST support async Rust commands
- **NFR-7**: Plugin MUST be compatible with existing Tauri app commands

### 5.3 Usability
- **NFR-8**: Plugin installation MUST require < 5 minutes
- **NFR-9**: Plugin configuration MUST require < 5 lines of code
- **NFR-10**: Error messages MUST be clear and actionable

### 5.4 Maintainability
- **NFR-11**: Code MUST follow Rust best practices
- **NFR-12**: Code MUST include comprehensive documentation
- **NFR-13**: Code MUST include unit tests
- **NFR-14**: Code MUST follow the Electron service pattern where applicable

## 6. Technical Approach

### 6.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Application                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Frontend (Browser Context)                 │ │
│  │                                                         │ │
│  │  window.TauriTest.execute(command, ...args)            │ │
│  │  window.TauriTest.mock(command, response)              │ │
│  │  window.TauriTest.clearMocks()                          │ │
│  └──────────────────────────────────────────────────────┘ │
│                          IPC                                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           @wdio/tauri-plugin (Rust Backend)            │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  execute_command(command, args)                 │ │ │
│  │  │    └─> Check mocks                               │ │ │
│  │  │    └─> Execute real command or return mock      │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  mock_command(command, response)                │ │ │
│  │  │    └─> Store in MockRegistry                     │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  clear_mocks()                                   │ │ │
│  │  │    └─> Clear MockRegistry                        │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  MockRegistry: HashMap<String, Value>            │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │        User's Tauri Commands (Rust Backend)            │ │
│  │                                                         │ │
│  │  get_platform_info()                                  │ │
│  │  read_file(path)                                        │ │
│  │  write_file(path, content)                            │ │
│  │  ...                                                    │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Implementation Details

#### 6.2.1 Rust Plugin Structure
```rust
// src/lib.rs
use tauri::command;

#[command]
pub async fn execute_command(
    command: String,
    args: Vec<serde_json::Value>,
    app_handle: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    // Check if command is mocked
    if let Some(mock_response) = get_mock(&command) {
        return Ok(mock_response);
    }

    // Execute real command via Tauri's invoke handler
    // This requires access to the app's invoke handler
    // which may need special handling
}

#[command]
pub async fn mock_command(
    command: String,
    response: serde_json::Value,
) -> Result<(), String> {
    set_mock(command, response);
    Ok(())
}

#[command]
pub async fn clear_mocks() -> Result<(), String> {
    clear_all_mocks();
    Ok(())
}
```

**Challenge**: Tauri plugins don't have direct access to the app's invoke handler. We need to:
1. Store references to user commands during plugin initialization, OR
2. Use Tauri's `Manager` API to invoke commands dynamically, OR
3. Require users to register their commands with the plugin

**Solution**: Use Tauri's `Manager` API to dynamically invoke commands via `app_handle.invoke()`.

#### 6.2.2 Mock Storage
```rust
use std::sync::Mutex;
use std::collections::HashMap;

lazy_static! {
    static ref MOCK_REGISTRY: Mutex<HashMap<String, serde_json::Value>> = Mutex::new(HashMap::new());
}

fn get_mock(command: &str) -> Option<serde_json::Value> {
    MOCK_REGISTRY.lock().unwrap().get(command).cloned()
}

fn set_mock(command: String, response: serde_json::Value) {
    MOCK_REGISTRY.lock().unwrap().insert(command, response);
}

fn clear_all_mocks() {
    MOCK_REGISTRY.lock().unwrap().clear();
}
```

#### 6.2.3 Frontend JavaScript Generation
The plugin will generate a JavaScript file that users include in their frontend:

```javascript
// Generated by @wdio/tauri-plugin
window.TauriTest = {
  async execute(command, ...args) {
    try {
      const result = await window.__TAURI__.core.invoke('execute_command', {
        command,
        args
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to execute Tauri command "${command}": ${error.message}`);
    }
  },

  async mock(command, response) {
    try {
      await window.__TAURI__.core.invoke('mock_command', {
        command,
        response
      });
    } catch (error) {
      throw new Error(`Failed to mock Tauri command "${command}": ${error.message}`);
    }
  },

  async clearMocks() {
    try {
      await window.__TAURI__.core.invoke('clear_mocks');
    } catch (error) {
      throw new Error(`Failed to clear mocks: ${error.message}`);
    }
  }
};
```

**Location**: The JavaScript file should be generated in the plugin's `dist/` directory and users can copy it to their frontend or import it directly.

### 6.3 Command Execution Flow

```
1. Test calls: browser.execute(() => window.TauriTest.execute('get_platform_info'))
2. Frontend JavaScript calls: window.__TAURI__.core.invoke('execute_command', { command: 'get_platform_info', args: [] })
3. Plugin receives: execute_command('get_platform_info', [])
4. Plugin checks MockRegistry for 'get_platform_info'
5a. If mocked: Return mock response immediately
5b. If not mocked:
   - Use app_handle.invoke('get_platform_info') to call user's command
   - Return result
6. Result propagates back through IPC to frontend
7. Frontend returns result to test
```

### 6.4 Mocking Flow

```
1. Test calls: browser.execute(() => window.TauriTest.mock('get_platform_info', 'mocked-platform'))
2. Frontend JavaScript calls: window.__TAURI__.core.invoke('mock_command', { command: 'get_platform_info', response: 'mocked-platform' })
3. Plugin receives: mock_command('get_platform_info', 'mocked-platform')
4. Plugin stores in MockRegistry: HashMap { 'get_platform_info' => 'mocked-platform' }
5. Future execute_command calls for 'get_platform_info' return 'mocked-platform'
```

## 7. Package Structure

```
packages/@wdio/tauri-plugin/
├── Cargo.toml              # Rust crate configuration
├── src/
│   ├── lib.rs              # Plugin entry point
│   ├── commands.rs        # Tauri command implementations
│   ├── mocks.rs            # Mock storage and management
│   └── utils.rs            # Utility functions
├── dist/
│   └── tauri-test.js       # Generated JavaScript interface
├── README.md               # User documentation
├── CHANGELOG.md            # Version history
└── LICENSE                 # MIT License
```

## 8. Integration with Tauri Service

### 8.1 Service Updates
The `@wdio/tauri-service` will be updated to:
1. Check for `window.TauriTest` availability
2. Use `window.TauriTest.execute()` when available
3. Fall back to `window.__TAURI__.core.invoke()` for backward compatibility
4. Implement mocking methods that use `window.TauriTest.mock()` and `window.TauriTest.clearMocks()`

### 8.2 API Surface
```typescript
// packages/tauri-service/src/types.ts
export interface TauriAPI {
  execute: <T = unknown>(command: string, ...args: unknown[]) => Promise<TauriResult<T>>;
  mock: (command: string, response: unknown) => Promise<void>;
  clearMocks: () => Promise<void>;
  // ... other methods
}
```

## 9. Testing Requirements

### 9.1 Unit Tests
- Mock storage and retrieval
- Command execution with and without mocks
- Error handling for invalid commands
- Mock clearing functionality

### 9.2 Integration Tests
- Full command execution flow
- Mocking flow end-to-end
- Frontend JavaScript interface
- Multiple mock registrations

### 9.3 E2E Tests
- Test with a real Tauri app
- Verify command execution works
- Verify mocking works
- Verify clearMocks works
- Test error scenarios

## 10. Dependencies

### 10.1 Rust Dependencies
```toml
[dependencies]
tauri = { version = "2.0", features = ["devtools"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
lazy_static = "1"
```

### 10.2 Build Tools
- Rust compiler (1.77+)
- Cargo
- Tauri CLI (for testing)

## 11. Open Questions and Future Considerations

### 11.1 Open Questions
1. **Command Registration**: How do we access user's commands? Do we need a registration step?
   - **Answer**: Use `app_handle.invoke()` which can dynamically call any registered command

2. **Mock Persistence**: Should mocks persist across app restarts or only during a session?
   - **Answer**: Only during a session (stored in memory Mutex)

3. **Partial Mocking**: Should we support partial mocking (mock some commands, not others)?
   - **Answer**: Not initially - all-or-nothing only

4. **JavaScript Distribution**: How do users include the generated JS file?
   - **Answer**: Include in dist/ directory, users copy to their frontend or use import

### 11.2 Future Enhancements
1. **Partial Mocking**: Allow mocking specific commands while others execute normally
2. **Mock Verification**: Track mock call counts and arguments
3. **Mock Reset**: Reset individual mocks without clearing all
4. **TypeScript Definitions**: Generate TypeScript types for the interface
5. **Command Validation**: Validate command names before execution
6. **Performance Metrics**: Track command execution times
7. **Mock History**: Store mock call history for debugging

## 12. Risks and Mitigations

### 12.1 Technical Risks
- **Risk**: Tauri plugin API limitations preventing command execution
  - **Mitigation**: Use Tauri's Manager API for dynamic invocation
  - **Contingency**: Require users to register commands with plugin

- **Risk**: Mock storage causing memory issues
  - **Mitigation**: Implement size limits and cleanup on app restart
  - **Contingency**: Use WeakMap or external storage

### 12.2 User Experience Risks
- **Risk**: Complex setup process
  - **Mitigation**: Provide clear documentation and examples
  - **Contingency**: Create setup wizard or CLI tool

- **Risk**: Incompatibility with existing apps
  - **Mitigation**: Maintain backward compatibility with `window.__TAURI__.core.invoke`
  - **Contingency**: Make plugin optional

## 13. Timeline and Milestones

### Phase 1: Core Plugin (Week 1-2)
- [ ] Create Rust plugin structure
- [ ] Implement `execute_command` functionality
- [ ] Implement basic mock storage
- [ ] Generate JavaScript interface
- [ ] Unit tests

### Phase 2: Mocking Support (Week 3)
- [ ] Implement `mock_command` functionality
- [ ] Implement `clear_mocks` functionality
- [ ] Integration tests
- [ ] Documentation

### Phase 3: Service Integration (Week 4)
- [ ] Update `@wdio/tauri-service` to use plugin
- [ ] Implement mocking methods in service
- [ ] E2E tests
- [ ] Example app updates

### Phase 4: Polish and Release (Week 5)
- [ ] Documentation review
- [ ] Performance optimization
- [ ] Release preparation
- [ ] Publishing

## 14. Success Metrics

### 14.1 Adoption Metrics
- Plugin installed in test app within 1 week
- Zero breaking changes to existing tests
- Positive developer feedback

### 14.2 Technical Metrics
- Command execution overhead < 10ms
- Mock lookup < 1ms
- 100% test coverage for core functionality
- Zero memory leaks in test sessions

### 14.3 User Experience Metrics
- Setup time < 5 minutes
- Documentation clarity score > 4/5
- Support tickets < 5 in first month

## 15. References

- [Tauri Plugin Documentation](https://v2.tauri.app/plugin/)
- [Electron Service Mocking Implementation](../packages/electron-service/src/mock.ts)
- [Tauri v2 Command Invocation](https://v2.tauri.app/develop/calling-rust/)
- [WebDriverIO Service Documentation](https://webdriver.io/docs/customservices)

