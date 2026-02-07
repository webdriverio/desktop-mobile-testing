// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

#[cfg(feature = "semver")]
use crate::semver_compat::semver_compat_string;

use crate::SingleInstanceCallback;
use std::ffi::CStr;
use tauri::{
    plugin::{self, TauriPlugin},
    AppHandle, Manager, RunEvent, Runtime,
};
use windows_sys::Win32::{
    Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HWND, LPARAM, LRESULT, WPARAM},
    System::{
        DataExchange::COPYDATASTRUCT,
        LibraryLoader::GetModuleHandleW,
        Threading::{CreateMutexW, OpenProcess, ReleaseMutex, TerminateProcess, PROCESS_TERMINATE},
    },
    UI::WindowsAndMessaging::{
        self as w32wm, CreateWindowExW, DefWindowProcW, DestroyWindow, FindWindowW,
        GetWindowThreadProcessId, RegisterClassExW, SendMessageW, CREATESTRUCTW, GWLP_USERDATA,
        GWL_STYLE, WINDOW_LONG_PTR_INDEX, WM_COPYDATA, WM_CREATE, WM_DESTROY, WNDCLASSEXW,
        WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT, WS_OVERLAPPED,
        WS_POPUP, WS_VISIBLE,
    },
};

const WMCOPYDATA_SINGLE_INSTANCE_DATA: usize = 1542;

/// Log to both stderr and a file for debugging detached processes
fn log_to_file(msg: &str) {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let pid = std::process::id();
    let log_line = format!("[{}] [PID:{}] {}\n", timestamp, pid, msg);

    // Always log to stderr
    eprintln!("{}", msg);

    // Also log to file
    let log_path = std::path::PathBuf::from("C:\\temp\\single-instance-debug.log");
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    use std::io::Write;
    let mut file = match std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        Ok(f) => f,
        Err(_) => return, // Silently fail if we can't open the file
    };

    let _ = file.write_all(log_line.as_bytes());
    let _ = file.flush();
}

struct MutexHandle(isize);

struct TargetWindowHandle(isize);

struct UserData<R: Runtime> {
    app: AppHandle<R>,
    callback: Box<SingleInstanceCallback<R>>,
}

impl<R: Runtime> UserData<R> {
    unsafe fn from_hwnd_raw(hwnd: HWND) -> *mut Self {
        GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut Self
    }

    unsafe fn from_hwnd<'a>(hwnd: HWND) -> &'a mut Self {
        &mut *Self::from_hwnd_raw(hwnd)
    }

    fn run_callback(&mut self, args: Vec<String>, cwd: String) {
        (self.callback)(&self.app, args, cwd)
    }
}

/// Check if the current process is a WebView2 child process.
/// WebView2 spawns child processes with --type= arguments (renderer, gpu-process, etc.)
/// These should not trigger the single-instance check as they are not user-facing instances.
fn is_webview2_child_process() -> bool {
    std::env::args().any(|arg| arg.starts_with("--type="))
}

pub fn init<R: Runtime>(callback: Box<SingleInstanceCallback<R>>) -> TauriPlugin<R> {
    // Log immediately on init - this should appear for ALL instances including second instances
    let args: Vec<String> = std::env::args().collect();
    log_to_file("[SINGLE-INSTANCE] ===============================================");
    log_to_file("[SINGLE-INSTANCE] SINGLE-INSTANCE PLUGIN INITIALIZING");
    log_to_file("[SINGLE-INSTANCE] PID: {}", std::process::id());
    log_to_file("[SINGLE-INSTANCE] Args: {:?}", args);
    eprintln!(
        "[SINGLE-INSTANCE] TAURI_WEBVIEW_AUTOMATION: {:?}",
        std::env::var("TAURI_WEBVIEW_AUTOMATION")
    );
    log_to_file("[SINGLE-INSTANCE] ===============================================");

    plugin::Builder::new("single-instance")
        .setup(|app, _api| {
            log_to_file("[SINGLE-INSTANCE] Plugin setup starting");

            #[allow(unused_mut)]
            let mut id = app.config().identifier.clone();
            #[cfg(feature = "semver")]
            {
                id.push('_');
                id.push_str(semver_compat_string(&app.package_info().version).as_str());
            }

            let class_name = encode_wide(format!("{id}-sic"));
            let window_name = encode_wide(format!("{id}-siw"));
            let mutex_name = encode_wide(format!("{id}-sim"));

            log_to_file("[SINGLE-INSTANCE] Mutex name: {id}-sim");
            log_to_file("[SINGLE-INSTANCE] Window name: {id}-siw");
            log_to_file("[SINGLE-INSTANCE] Class name: {id}-sic");

            let hmutex =
                unsafe { CreateMutexW(std::ptr::null(), true.into(), mutex_name.as_ptr()) };

            let last_error = unsafe { GetLastError() };
            eprintln!(
                "[SINGLE-INSTANCE] CreateMutexW returned, last_error={}",
                last_error
            );

            // Determine whether we should become the primary instance.
            // There are three scenarios when ERROR_ALREADY_EXISTS:
            //   1. WebView2 child process (--type= arg) → skip entirely
            //   2. WebDriver automation (TAURI_WEBVIEW_AUTOMATION) → take over as primary
            //      (the existing mutex is from a stale/ghost process; WebDriver manages lifecycle)
            //   3. Normal second instance → forward data to primary and exit
            let become_primary = if last_error == ERROR_ALREADY_EXISTS {
                log_to_file("[SINGLE-INSTANCE] ERROR_ALREADY_EXISTS - another instance is running");

                if is_webview2_child_process() {
                    log_to_file("[SINGLE-INSTANCE] WebView2 child process detected, allowing to continue");
                    unsafe { CloseHandle(hmutex) };
                    return Ok(());
                }

                if std::env::var("TAURI_WEBVIEW_AUTOMATION").is_ok() {
                    // Running under WebDriver automation (tauri-driver sets this env var).
                    // The stale mutex is from a ghost process that the CI cleanup didn't
                    // fully terminate. We must become the primary instance so that:
                    //   - WebDriver can create a session (app doesn't exit)
                    //   - Deep link triggers from protocol handlers are forwarded to us
                    log_to_file("[SINGLE-INSTANCE] WebDriver automation detected - taking over as primary instance");

                    // Kill the ghost process that holds the stale mutex/window.
                    // If we don't, FindWindowW from protocol-handler-launched instances
                    // may find the ghost's IPC window instead of ours, sending deeplink
                    // data to the wrong process.
                    unsafe {
                        let ghost_hwnd = FindWindowW(class_name.as_ptr(), window_name.as_ptr());
                        if !ghost_hwnd.is_null() {
                            let mut ghost_pid: u32 = 0;
                            GetWindowThreadProcessId(ghost_hwnd, &mut ghost_pid);
                            log_to_file("[SINGLE-INSTANCE] Found ghost window hwnd={:?}, pid={}", ghost_hwnd, ghost_pid);
                            if ghost_pid != 0 && ghost_pid != std::process::id() {
                                let hprocess = OpenProcess(PROCESS_TERMINATE, 0, ghost_pid);
                                if !hprocess.is_null() {
                                    log_to_file("[SINGLE-INSTANCE] Terminating ghost process pid={}", ghost_pid);
                                    TerminateProcess(hprocess, 1);
                                    CloseHandle(hprocess);
                                    // Wait briefly for the ghost's window to be destroyed by the OS
                                    std::thread::sleep(std::time::Duration::from_millis(500));
                                } else {
                                    log_to_file("[SINGLE-INSTANCE] Could not open ghost process pid={}", ghost_pid);
                                }
                            }
                        } else {
                            log_to_file("[SINGLE-INSTANCE] No ghost window found (ghost may have already exited)");
                        }
                    }

                    true
                } else {
                    log_to_file("[SINGLE-INSTANCE] This is a second instance, looking for first instance window...");

                    unsafe {
                        let hwnd = FindWindowW(class_name.as_ptr(), window_name.as_ptr());

                        log_to_file("[SINGLE-INSTANCE] FindWindowW returned hwnd={:?}", hwnd);

                        if !hwnd.is_null() {
                            log_to_file("[SINGLE-INSTANCE] Found first instance window, sending data...");
                            let cwd = std::env::current_dir().unwrap_or_default();
                            let cwd = cwd.to_str().unwrap_or_default();

                            let args = std::env::args().collect::<Vec<String>>().join("|");

                            let data = format!("{cwd}|{args}\0",);

                            let bytes = data.as_bytes();
                            let cds = COPYDATASTRUCT {
                                dwData: WMCOPYDATA_SINGLE_INSTANCE_DATA,
                                cbData: bytes.len() as _,
                                lpData: bytes.as_ptr() as _,
                            };

                            log_to_file("[SINGLE-INSTANCE] Calling SendMessageW with WM_COPYDATA...");
                            log_to_file("[SINGLE-INSTANCE] Target hwnd: {:?}", hwnd);
                            log_to_file("[SINGLE-INSTANCE] Data being sent: {}", data);
                            let result = SendMessageW(hwnd, WM_COPYDATA, 0, &cds as *const _ as _);
                            log_to_file("[SINGLE-INSTANCE] SendMessageW returned: {}", result);
                            if result == 0 {
                                log_to_file("[SINGLE-INSTANCE] WARNING: SendMessageW returned 0, message may not have been processed");
                            } else {
                                log_to_file("[SINGLE-INSTANCE] SendMessageW succeeded, data sent to first instance");
                            }
                            log_to_file("[SINGLE-INSTANCE] Exiting second instance...");

                            app.cleanup_before_exit();
                            std::process::exit(0);
                        } else {
                            log_to_file("[SINGLE-INSTANCE] ERROR: FindWindowW returned NULL - could not find first instance window!");
                            log_to_file("[SINGLE-INSTANCE] Window class: {:?}", class_name);
                            log_to_file("[SINGLE-INSTANCE] Window name: {:?}", window_name);
                            log_to_file("[SINGLE-INSTANCE] Last error: {:?}", unsafe { GetLastError() });
                        }
                    }
                    // Window not found - fall through to become primary
                    true
                }
            } else {
                log_to_file("[SINGLE-INSTANCE] No existing mutex found - this is the FIRST instance");
                true
            };

            if become_primary {
                app.manage(MutexHandle(hmutex as _));

                let userdata = UserData {
                    app: app.clone(),
                    callback,
                };
                let userdata = Box::into_raw(Box::new(userdata));
                let hwnd = create_event_target_window::<R>(&class_name, &window_name, userdata);
                log_to_file("[SINGLE-INSTANCE] Event target window created: hwnd={:?}", hwnd);
                app.manage(TargetWindowHandle(hwnd as _));
                log_to_file("[SINGLE-INSTANCE] Primary instance setup complete - mutex and window created");
            }

            log_to_file("[SINGLE-INSTANCE] Plugin setup completed successfully");
            Ok(())
        })
        .on_event(|app, event| {
            if let RunEvent::Exit = event {
                destroy(app);
            }
        })
        .build()
}

pub fn destroy<R: Runtime, M: Manager<R>>(manager: &M) {
    log_to_file("[SINGLE-INSTANCE] Destroy called - cleaning up mutex and window");
    if let Some(hmutex) = manager.try_state::<MutexHandle>() {
        log_to_file("[SINGLE-INSTANCE] Releasing mutex");
        unsafe {
            ReleaseMutex(hmutex.0 as _);
            CloseHandle(hmutex.0 as _);
        }
        log_to_file("[SINGLE-INSTANCE] Mutex released and handle closed");
    } else {
        log_to_file("[SINGLE-INSTANCE] No mutex found to release");
    }
    if let Some(hwnd) = manager.try_state::<TargetWindowHandle>() {
        log_to_file("[SINGLE-INSTANCE] Destroying event target window");
        unsafe { DestroyWindow(hwnd.0 as _) };
        log_to_file("[SINGLE-INSTANCE] Event target window destroyed");
    } else {
        log_to_file("[SINGLE-INSTANCE] No event target window found to destroy");
    }
}

unsafe extern "system" fn single_instance_window_proc<R: Runtime>(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_CREATE => {
            let create_struct = &*(lparam as *const CREATESTRUCTW);
            let userdata = create_struct.lpCreateParams as *const UserData<R>;
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, userdata as _);
            0
        }

        WM_COPYDATA => {
            log_to_file("[SINGLE-INSTANCE] WM_COPYDATA received!");
            let cds_ptr = lparam as *const COPYDATASTRUCT;
            eprintln!(
                "[SINGLE-INSTANCE] COPYDATASTRUCT dwData: {}",
                (*cds_ptr).dwData
            );
            eprintln!(
                "[SINGLE-INSTANCE] Expected dwData: {}",
                WMCOPYDATA_SINGLE_INSTANCE_DATA
            );
            if (*cds_ptr).dwData == WMCOPYDATA_SINGLE_INSTANCE_DATA {
                log_to_file("[SINGLE-INSTANCE] Data matches! Processing...");
                let userdata = UserData::<R>::from_hwnd(hwnd);

                let data = CStr::from_ptr((*cds_ptr).lpData as _).to_string_lossy();
                log_to_file("[SINGLE-INSTANCE] Raw data received: {}", data);
                let mut s = data.split('|');
                let cwd = s.next().unwrap();
                let args: Vec<String> = s.map(|s| s.to_string()).collect();
                log_to_file("[SINGLE-INSTANCE] Parsed - CWD: {}, Args: {:?}", cwd, args);

                userdata.run_callback(args, cwd.to_string());
                log_to_file("[SINGLE-INSTANCE] Callback executed successfully");
            } else {
                log_to_file("[SINGLE-INSTANCE] Data does not match expected dwData - ignoring");
            }
            1
        }

        WM_DESTROY => {
            let userdata = UserData::<R>::from_hwnd_raw(hwnd);
            drop(Box::from_raw(userdata));
            0
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

fn create_event_target_window<R: Runtime>(
    class_name: &[u16],
    window_name: &[u16],
    userdata: *const UserData<R>,
) -> HWND {
    unsafe {
        let class = WNDCLASSEXW {
            cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
            style: 0,
            lpfnWndProc: Some(single_instance_window_proc::<R>),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: GetModuleHandleW(std::ptr::null()),
            hIcon: std::ptr::null_mut(),
            hCursor: std::ptr::null_mut(),
            hbrBackground: std::ptr::null_mut(),
            lpszMenuName: std::ptr::null(),
            lpszClassName: class_name.as_ptr(),
            hIconSm: std::ptr::null_mut(),
        };

        RegisterClassExW(&class);

        let hwnd = CreateWindowExW(
            WS_EX_NOACTIVATE
            | WS_EX_TRANSPARENT
            | WS_EX_LAYERED
            // WS_EX_TOOLWINDOW prevents this window from ever showing up in the taskbar, which
            // we want to avoid. If you remove this style, this window won't show up in the
            // taskbar *initially*, but it can show up at some later point. This can sometimes
            // happen on its own after several hours have passed, although this has proven
            // difficult to reproduce. Alternatively, it can be manually triggered by killing
            // `explorer.exe` and then starting the process back up.
            // It is unclear why the bug is triggered by waiting for several hours.
            | WS_EX_TOOLWINDOW,
            class_name.as_ptr(),
            window_name.as_ptr(),
            WS_OVERLAPPED,
            0,
            0,
            0,
            0,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            GetModuleHandleW(std::ptr::null()),
            userdata as _,
        );
        SetWindowLongPtrW(
            hwnd,
            GWL_STYLE,
            // The window technically has to be visible to receive WM_PAINT messages (which are used
            // for delivering events during resizes), but it isn't displayed to the user because of
            // the LAYERED style.
            (WS_VISIBLE | WS_POPUP) as isize,
        );
        hwnd
    }
}

pub fn encode_wide(string: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    std::os::windows::prelude::OsStrExt::encode_wide(string.as_ref())
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(target_pointer_width = "32")]
#[allow(non_snake_case)]
unsafe fn SetWindowLongPtrW(hwnd: HWND, index: WINDOW_LONG_PTR_INDEX, value: isize) -> isize {
    w32wm::SetWindowLongW(hwnd, index, value as _) as _
}

#[cfg(target_pointer_width = "64")]
#[allow(non_snake_case)]
unsafe fn SetWindowLongPtrW(hwnd: HWND, index: WINDOW_LONG_PTR_INDEX, value: isize) -> isize {
    w32wm::SetWindowLongPtrW(hwnd, index, value)
}

#[cfg(target_pointer_width = "32")]
#[allow(non_snake_case)]
unsafe fn GetWindowLongPtrW(hwnd: HWND, index: WINDOW_LONG_PTR_INDEX) -> isize {
    w32wm::GetWindowLongW(hwnd, index) as _
}

#[cfg(target_pointer_width = "64")]
#[allow(non_snake_case)]
unsafe fn GetWindowLongPtrW(hwnd: HWND, index: WINDOW_LONG_PTR_INDEX) -> isize {
    w32wm::GetWindowLongPtrW(hwnd, index)
}
