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

---

# Phase 2: Ghost Process Discovery and Fix

## Updated Problem Summary (Post-Investigation)

The deeplink E2E tests fail on Windows CI. The root cause is a **ghost Tauri app process** that holds the single-instance mutex and IPC window, interfering with both WebDriver session creation and deeplink delivery.

Linux tests are unaffected because the single-instance plugin uses D-Bus (not Windows mutexes/windows) and has no ghost process issue.

## Updated Architecture

```
WDIO Test Runner
  └─ tauri-driver (port X)           ← spawned by launcher.ts
       └─ msedgedriver (port X+1)    ← spawned by tauri-driver
            └─ tauri-e2e-app.exe     ← spawned by msedgedriver

Protocol Handler (deeplink trigger):
  rundll32.exe url.dll,FileProtocolHandler testapp://...
    └─ cmd /c "set ENABLE_SINGLE_INSTANCE=true && tauri-e2e-app.exe testapp://..."
       └─ tauri-e2e-app.exe          ← launched by OS, NOT a child of tauri-driver
```

Key env vars:
- `TAURI_WEBVIEW_AUTOMATION=true` — set by tauri-driver's `webdriver.rs` on msedgedriver's env, propagated to app. **NOT set** for protocol-handler-launched instances.
- `ENABLE_SINGLE_INSTANCE=true` — set in `wdio:tauriServiceOptions.env` for deeplink tests, AND in the Windows registry command for protocol handler launches.

## Root Cause: Ghost Process

A ghost `tauri-e2e-app.exe` process exists on the Windows CI runner before the test starts. It holds:
- Named mutex: `com.tauri.basic-sim`
- IPC window: class `com.tauri.basic-sic`, name `com.tauri.basic-siw`

### Ghost Process Origin

The exact origin is not definitively identified. Candidates:
1. **GitHub Actions runner reuse** between jobs within the same workflow run
2. **A previous job that was retried/cancelled** leaving orphaned processes
3. **msedgedriver detaching from tauri-driver's Job Object** — tauri-driver uses `limit_kill_on_job_close()` but this may not always cascade correctly

The CI cleanup step (`Get-Process -Name "tauri-e2e-app" | Stop-Process`) runs before the test, but the ghost survives. Adding `msedgedriver` to cleanup (commit e6da9ce) provides defense-in-depth but may not fully solve the timing issue.

**Evidence the ghost is real**: In the `deeplink-tauri 5` logs, 738 `[WDIO-FRONTEND]` log lines appear starting at 11:40:31.265Z — **before** tauri-driver even spawns at 11:40:32.328Z. These are from a running Tauri app's WebView2 frontend.

### How the Ghost Causes Two Distinct Failures

#### Failure 1: "Chrome instance exited" (session creation)

Without the fix, ALL app instances launched by msedgedriver detect `ERROR_ALREADY_EXISTS` (error 183) from the ghost's mutex. Since they don't have `--type=` args (not WebView2 child processes), they take the normal second-instance path:
1. `FindWindowW` → finds ghost's IPC window (e.g., `hwnd=0x40050`)
2. `SendMessageW(WM_COPYDATA)` → sends args to ghost
3. `process::exit(0)` — **app exits before WebView2 initializes**

msedgedriver sees the Chrome/WebView2 process exit and reports "Chrome instance exited". WDIO retries, msedgedriver launches another instance, same thing. After 4 retries, session creation fails.

#### Failure 2: "App did not receive the deeplink" (deeplink delivery)

After fixing session creation (by checking `TAURI_WEBVIEW_AUTOMATION`), the WebDriver-managed app starts successfully and creates its own IPC window (e.g., `hwnd=0x10488`). But now **two** IPC windows exist with the same class/name:
- Ghost: `hwnd=0x40050`
- Ours: `hwnd=0x10488`

When `rundll32` triggers the protocol handler, the OS launches a new app instance (without `TAURI_WEBVIEW_AUTOMATION`). It calls `FindWindowW` which returns the **ghost's** window first (Z-order dependent). The deeplink data is sent to the ghost, which silently discards it. Our app never receives it.

## Fix Implementation

### Fix 1: Take over as primary under WebDriver automation

In `patches/tauri-plugin-single-instance/src/platform_impl/windows.rs`:

When `ERROR_ALREADY_EXISTS` is detected AND `TAURI_WEBVIEW_AUTOMATION` env var is set, the app continues as primary instance instead of exiting. This works because:
- WebDriver-managed instances have `TAURI_WEBVIEW_AUTOMATION=true` (from tauri-driver)
- Protocol handler instances do NOT (launched by OS directly)

### Fix 2: Kill the ghost process

When taking over as primary under WebDriver automation, the plugin now:
1. `FindWindowW` — locates the ghost's IPC window
2. `GetWindowThreadProcessId` — gets the ghost's PID
3. `OpenProcess(PROCESS_TERMINATE)` + `TerminateProcess` — kills the ghost
4. `sleep(500ms)` — waits for the OS to destroy the ghost's window
5. Creates our own IPC window (now the only one)

This ensures protocol-handler-launched instances find **our** window, not the ghost's.

```rust
if std::env::var("TAURI_WEBVIEW_AUTOMATION").is_ok() {
    eprintln!("[SINGLE-INSTANCE] WebDriver automation detected - taking over as primary instance");
    unsafe {
        let ghost_hwnd = FindWindowW(class_name.as_ptr(), window_name.as_ptr());
        if !ghost_hwnd.is_null() {
            let mut ghost_pid: u32 = 0;
            GetWindowThreadProcessId(ghost_hwnd, &mut ghost_pid);
            if ghost_pid != 0 && ghost_pid != std::process::id() {
                let hprocess = OpenProcess(PROCESS_TERMINATE, 0, ghost_pid);
                if !hprocess.is_null() {
                    TerminateProcess(hprocess, 1);
                    CloseHandle(hprocess);
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
            }
        }
    }
    true // become primary
}
```

### Fix 3: CI cleanup includes msedgedriver (defense-in-depth)

Added `msedgedriver` to both pre-test and post-test Windows cleanup steps in `_ci-e2e-tauri.reusable.yml`. This reduces the chance of ghost processes surviving between test runs.

## Investigation Timeline

### Phase 1: Initial attempts (incorrect theory)
- **Theory**: WebView2 child processes (with `--type=` args) trigger single-instance exit
- **Fix**: Added `is_webview2_child_process()` check
- **Result**: No effect — test app instances don't have `--type=` args

### Phase 2: Enhanced logging
Added `[SINGLE-INSTANCE]`, `[DEEP-LINK-DEBUG]`, `[DEEP-LINK-PLUGIN]` logging
- Patched both single-instance and deep-link plugins with debug output
- **Key finding**: App exits in single-instance plugin setup (during `run()`), BEFORE Tauri's `setup()` callback

### Phase 3: Ghost process identified (deeplink-tauri 5 logs)
- ALL 4 app instances see `ERROR_ALREADY_EXISTS` (error 183) on first launch
- ALL find the same window `hwnd=0x40050` and exit
- 738 WDIO-FRONTEND logs from a pre-existing Tauri app running before the test

### Phase 4: TAURI_WEBVIEW_AUTOMATION fix
- Session creation: **FIXED** (Session ID: c4e2a43c79dd39ce83989bbc368327c2)
- Deeplink delivery: **STILL FAILING** — "App did not receive the deeplink within 5 seconds"
- Root cause: ghost's IPC window intercepts deeplink data

### Phase 5: Ghost process termination (current)
- Added `TerminateProcess` call to kill the ghost when detected under WebDriver automation
- Added msedgedriver to CI cleanup
- **Result**: Ghost is killed successfully (logs show "Found ghost window hwnd=0x401e8, pid=5364 → Terminating ghost process pid=5364")
- **But**: Deeplinks still fail to arrive at the app

### Phase 6: Debugging deeplink delivery (latest)

**Current Status** (from `deeplink-tauri-ghostbusters` logs):
- ✅ Ghost process killed successfully
- ✅ Session created successfully (Session ID: 220c6392912b04a010af76e2a60f8927)
- ✅ App creates IPC window (`hwnd=0x301c2`)
- ❌ Deeplink tests still fail: "App did not receive the deeplink within 5 seconds"

**Key Finding**: The single-instance callback is **NEVER triggered** during the test. No logs show "SINGLE-INSTANCE CALLBACK TRIGGERED!" after the initial app launch.

**Investigation**:
1. Protocol handler launches `rundll32.exe url.dll,FileProtocolHandler testapp://...` successfully
2. rundll32 spawns with PIDs (6504, 3776, 856, 6944, etc.)
3. **BUT**: No new tauri-e2e-app instances appear in logs
4. The app instances launched by protocol handler are **detached processes** - not captured by tauri-driver

**Hypothesis**: The protocol handler is either:
1. Not actually launching the app (registry issue)
2. Launching the app but it's crashing immediately
3. Launching the app but the WM_COPYDATA message isn't being received

**Debugging Added**:
1. CI step to check for ghost processes before cleanup (`tasklist | findstr tauri-e2e-app`)
2. Enhanced WM_COPYDATA logging in single-instance plugin:
   - Log when WM_COPYDATA message is received
   - Log dwData values (received vs expected)
   - Log raw data and parsed arguments
   - Track callback execution

**Next Steps**:
1. Run CI with enhanced logging to see if WM_COPYDATA messages are received
2. Check if protocol handler registry is correct
3. Consider adding file-based logging for detached processes (since tauri-driver can't capture their output)
4. Verify the `testapp://` protocol is properly registered in Windows registry

### Phase 7: Ghost Process Monitor Results

**Ghost Process Monitor Output** (from latest CI run):
The monitor revealed the full timeline of process creation:

**WebDriver-Managed Instances:**
- **14:45:31** - PID 6560 (Parent: msedgedriver) ← Initial WebDriver instance
- **14:49:31** - PID 9508 (Parent: msedgedriver) ← Replacement after ghost-busting

**Detached/Orphaned Processes** (launched by protocol handler, empty parent PID):
- **14:45:37** - PID 6428
- **14:46:08** - PID 7440
- **14:46:39** - PID 2468
- **14:47:10** - PID 6280
- **14:47:41** - PID 9576
- **14:48:17** - PID 10116
- **14:48:48** - PID 10912
- **14:49:19** - PID 10668
- **14:49:33** - PID 5160
- **14:50:04** - PID 6392
- **14:50:35** - PID 10936
- **14:51:06** - PID 8972
- **14:51:37** - PID 10488
- **14:52:13** - PID 9876
- **14:52:44** - PID 10300
- **14:53:15** - PID 11592

**Key Findings:**
1. **16 detached processes** created throughout the test run (every ~30 seconds)
2. **All have empty parent PIDs** - confirming they are orphaned processes
3. **Protocol handler IS working** - it's successfully launching app instances
4. **Processes accumulate over time** - from 1 to 17 total processes
5. **File-based logging added** - logs now written to `C:\temp\single-instance-debug.log` for detached processes

**Current Status:**
- Ghost process detection and termination: ✅ Working
- Session creation: ✅ Fixed
- Protocol handler launching instances: ✅ Confirmed
- Deeplink delivery: ⏳ Still debugging - need to check file-based logs
- File-based logging: ✅ Implemented for detached process debugging

## Files Involved

- `patches/tauri-plugin-single-instance/src/platform_impl/windows.rs` — Single-instance mutex/IPC logic (main fix)
- `scripts/protocol-handlers/setup-protocol-handler.ps1` — Windows registry protocol handler setup
- `.github/workflows/_ci-e2e-tauri.reusable.yml` — CI workflow with cleanup steps and ghost detection
- `fixtures/e2e-apps/tauri/src-tauri/src/main.rs` — App initialization, plugin registration
- `e2e/wdio.tauri.conf.ts` — WDIO config, deeplink uses `maxInstances=1` + `ENABLE_SINGLE_INSTANCE=true`

## Current Status (Latest)

- **Build**: ✅ Builds successfully on both Windows and Linux
- **Session creation**: ✅ Fixed (TAURI_WEBVIEW_AUTOMATION bypass + ghost termination)
- **Deeplink delivery**: ⏳ Debugging in progress - WM_COPYDATA messages not being received
- **Linux tests**: ✅ Pass (sporadic logging test failure is unrelated)
- **Standard Windows tests**: ✅ Unaffected (don't use ENABLE_SINGLE_INSTANCE)
- **Ghost detection**: ✅ Added CI step to detect ghost processes before cleanup
- **Enhanced logging**: ✅ Added detailed WM_COPYDATA logging to diagnose message delivery
- **Ghost process monitor**: ✅ Background monitor tracks process creation during tests
- **File-based logging**: ✅ All logs now written to wdio logs directory for artifact collection
