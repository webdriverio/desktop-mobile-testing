# Windows Deeplink E2E Test Failure Analysis

## Problem Summary

The deeplink E2E tests are failing on Windows with the error:
```
WebDriverError: session not created: Chrome instance exited
```

The same tests pass on Linux. The issue appears to be specific to Windows and affects the WebDriver session creation process.

## Key Observations from Logs

### 1. Multiple App Instances Launching

From `deeplink-tauri 3/wdio.log`:
- **4 app instances start within ~2 seconds** (timestamps: 02:43:30.170, 02:43:30.249, 02:43:30.830, 02:43:31.900)
- Each instance logs: `"App starting with 3 args"`
- Each instance initializes the single-instance plugin as the **"first" instance**
- **None detect an existing mutex** - all say "Single-instance plugin initialized successfully"

### 2. WebDriver Retry Pattern

From `deeplink-tauri 3/wdio-0-0.log`:
- Session creation attempts at: 02:43:30.134, 02:43:30.227, 02:43:30.803, 02:43:31.879
- Each attempt fails with: `"Chrome instance exited"`
- **WebDriver is retrying session creation, and each retry launches a new app instance**

### 3. Successful Session Briefly Exists

Interestingly, a WebDriver session WAS created successfully:
- Session ID: `e615cbfc14315651f98eb6959eb504c0`
- Commands executed successfully (plugin detection, console wrapping)
- But then Chrome/WebView2 process exits

### 4. App Arguments

All app instances start with identical arguments:
```
["D:\\a\\desktop-mobile\\desktop-mobile\\fixtures\\e2e-apps\\tauri\\src-tauri\\target\\release\\tauri-e2e-app.exe", "--bar=baz", "--foo"]
```

**Critical**: None have `--type=` arguments, meaning these are NOT WebView2 child processes - they're separate top-level app launches by WebDriver.

## What We've Tried

### Attempt 1: Patch Single-Instance Plugin for WebView2 Child Processes

**Theory**: WebView2 on Windows spawns child processes (renderer, GPU, etc.) that inherit command-line arguments. Each child process triggers the single-instance mutex check and exits, causing ChromeDriver to fail.

**Solution Implemented**:
- Created patched plugin at `patches/tauri-plugin-single-instance/`
- Added `is_webview2_child_process()` function to detect `--type=` arguments
- Modified mutex check to allow child processes to continue instead of exiting
- Updated E2E app to use local patched plugin

**Code Changes**:
```rust
// Added to windows.rs
fn is_webview2_child_process() -> bool {
    std::env::args().any(|arg| arg.starts_with("--type="))
}

// Modified mutex check
if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
    if is_webview2_child_process() {
        unsafe { CloseHandle(hmutex) };
        return Ok(());
    }
    // ... existing logic
}
```

**Result**: Build succeeds, but tests still fail with same error.

**Why It Didn't Work**: The logs show that **none of the app instances have `--type=` arguments**. This means WebDriver is launching multiple top-level app instances, not WebView2 spawning child processes. Our fix was addressing the wrong problem.

### Attempt 2: Fix zbus Version for Linux Build

**Issue**: Linux build failed with:
```
error[E0599]: no method named `replace_existing_names` found for struct `zbus::blocking::ConnectionBuilder`
```

**Fix**: Updated zbus from `"4"` to `"5"` in patched plugin's Cargo.toml.

**Result**: Linux build now works, but Windows tests still fail.

## Root Cause Analysis

### The Real Problem

The issue is **NOT** WebView2 child processes. The problem is:

1. **WebDriver/EdgeDriver launches the app to create a session**
2. **The app starts, creates a mutex, initializes successfully**
3. **WebDriver either:**
   - Times out waiting for the app to be ready
   - Can't connect to WebView2 properly
   - The app crashes during initialization
4. **WebDriver retries, launching a new app instance**
5. **The previous app instance is killed, releasing its mutex**
6. **The new instance becomes the "first" instance (no mutex collision)**
7. **This cycle repeats 4 times until WebDriver gives up**

### Evidence Supporting This Theory

1. **All instances have identical arguments** - no `--type=` prefix
2. **Mutex isn't persisting** - each instance becomes "first" instance
3. **Timing alignment** - WebDriver retries coincide with new app launches
4. **Session briefly exists** - app DOES start successfully, but Chrome exits shortly after
5. **No child process logs** - no evidence of WebView2 spawning child processes

### Why the Mutex Isn't Persisting

Possible explanations:

1. **App crashes immediately after initialization**
   - App initializes plugin successfully
   - But crashes during window creation or WebView2 initialization
   - Mutex is released when process exits
   - Next launch creates new mutex

2. **WebDriver kills the app process**
   - WebDriver has a timeout for session creation
   - If app doesn't respond in time, WebDriver kills it
   - Mutex released, next retry creates new instance

3. **Mutex creation timing issue**
   - Mutex is created but not fully established
   - Next instance checks before mutex is visible
   - Race condition

## What We Know Works

From the successful logs:
- Linux deeplink tests pass
- Standard (non-deeplink) Windows tests pass
- The app binary IS valid and can run
- WebDriver CAN connect successfully (session exists briefly)

## Potential Next Steps

### Option 1: Add Detailed Logging to App

**Goal**: Determine exactly where the app is failing/crashing

**Implementation**:
- Add logging at every step of initialization:
  - Before/after window creation
  - WebView2 initialization status
  - Any errors during setup
  - When app receives deeplink trigger command
- Check if window is actually created
- Check if WebView2 is initializing properly

**Files to modify**:
- `fixtures/e2e-apps/tauri/src-tauri/src/main.rs`

### Option 2: Investigate WebDriver Timeout Configuration

**Goal**: Check if WebDriver is timing out too quickly

**Implementation**:
- Check WebDriver/EdgeDriver timeout settings
- Increase timeout if necessary
- Check if there's a mismatch between EdgeDriver version and WebView2 version

**Files to check**:
- WebDriver configuration in wdio.conf.ts
- CI workflow configuration
- EdgeDriver version vs WebView2 version

### Option 3: Check for Window Creation Issues

**Goal**: Verify the app is creating a window properly

**Implementation**:
- Add explicit logging around window creation
- Check if `ENABLE_SPLASH_WINDOW=false` is causing issues
- Try creating a minimal window first to test WebDriver connection
- Check Windows Event Viewer for crash logs

**Files to modify**:
- `fixtures/e2e-apps/tauri/src-tauri/src/main.rs`

### Option 4: Investigate Single-Instance Plugin Mutex Persistence

**Goal**: Understand why the mutex isn't being detected by subsequent instances

**Implementation**:
- Add logging to show mutex name being used
- Log when mutex is created/released
- Check if there's a permissions issue with the mutex
- Verify mutex is created with correct security attributes

**Files to modify**:
- `patches/tauri-plugin-single-instance/src/platform_impl/windows.rs`

### Option 5: Test Without Single-Instance Plugin

**Goal**: Determine if single-instance plugin is causing the issue

**Implementation**:
- Temporarily disable single-instance plugin
- Run tests to see if they pass without it
- If they pass, the issue is related to single-instance behavior
- If they still fail, the issue is elsewhere (WebDriver, WebView2, etc.)

**Files to modify**:
- `fixtures/e2e-apps/tauri/src-tauri/src/main.rs` (set `ENABLE_SINGLE_INSTANCE` to false)

### Option 6: Check WebView2/EdgeDriver Compatibility

**Goal**: Verify version compatibility

**Implementation**:
- Check WebView2 version installed on CI runners
- Check EdgeDriver version being used
- Look for version mismatch warnings in logs
- Consider using specific WebView2 version

**Files to check**:
- CI workflow logs
- WebDriver configuration

### Option 7: Compare with Working Windows Tests

**Goal**: Identify differences between working and failing tests

**Implementation**:
- Compare standard Windows test logs with deeplink test logs
- Check if standard tests also launch multiple instances
- Check if standard tests have single-instance plugin enabled
- Identify any configuration differences

**Files to compare**:
- `fixtures/e2e-apps/tauri/src-tauri/src/main.rs` (check if single-instance is enabled for standard tests)
- CI workflow configuration for standard vs deeplink tests

## Recommended Approach

**Start with Option 1 (Detailed Logging)** because:
1. We need to understand exactly where the app is failing
2. It will tell us if the app is crashing, hanging, or being killed
3. It's non-invasive and can be done quickly
4. The logs will guide which of the other options to pursue

**Then proceed based on findings**:
- If app is crashing during window creation → Option 3
- If app is being killed by WebDriver → Option 2
- If mutex isn't working → Option 4
- If unsure → Option 5 to isolate the single-instance plugin

## Questions to Answer

1. Is the app crashing during initialization? If so, where?
2. Is WebDriver killing the app due to timeout?
3. Why isn't the mutex being detected by subsequent instances?
4. Is there a version mismatch between EdgeDriver and WebView2?
5. Do standard (non-deeplink) Windows tests also launch multiple instances?

## Files Involved

- `fixtures/e2e-apps/tauri/src-tauri/src/main.rs` - App initialization
- `patches/tauri-plugin-single-instance/src/platform_impl/windows.rs` - Single-instance logic
- `patches/tauri-plugin-single-instance/Cargo.toml` - Plugin dependencies
- `fixtures/e2e-apps/tauri/src-tauri/Cargo.toml` - App dependencies
- CI workflow files in `.github/workflows/` - Test configuration
- WDIO configuration - WebDriver settings

## Current Status

- **Build**: ✅ Builds successfully on both Windows and Linux
- **Single-instance plugin patch**: ✅ Applied and working (but not solving the actual problem)
- **Test execution**: ❌ Still failing with "Chrome instance exited"
- **Root cause**: ❌ Not yet identified - need more logging/investigation
