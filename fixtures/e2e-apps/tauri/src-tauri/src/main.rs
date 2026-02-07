// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// NOTE: This also detaches stdout/stderr in release mode on Windows, preventing log capture.
// E2E tests use debug builds on Windows to preserve stdout/stderr for logging tests.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;
use once_cell::sync::Lazy;

static DEEP_LINKS: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));
static DEEP_LINK_LOG: Lazy<Option<Mutex<std::fs::File>>> = Lazy::new(|| {
    let log_path = std::env::temp_dir().join("tauri-deep-link-debug.log");
    let _ = std::fs::remove_file(&log_path); // Clear log on startup
    match OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        Ok(file) => Some(Mutex::new(file)),
        Err(e) => {
            eprintln!("[DEEP-LINK-DEBUG] Failed to open log file at {:?}: {}", log_path, e);
            None
        }
    }
});

fn log_deep_link(message: &str) {
    let timestamp = chrono::Local::now().format("%H:%M:%S%.3f");
    let pid = std::process::id();
    let log_line = format!("[{}] [PID {}] {}\n", timestamp, pid, message);
    eprintln!("[DEEP-LINK-DEBUG] {}", message);
    if let Some(ref log) = *DEEP_LINK_LOG {
        if let Ok(mut file) = log.lock() {
            let _ = file.write_all(log_line.as_bytes());
        }
    }
}

fn collect_deep_links_from_args() -> Vec<String> {
    let mut deep_links = Vec::new();
    for arg in std::env::args().skip(1) {
        if arg.starts_with("testapp://") {
            deep_links.push(arg.clone());
        }
    }
    deep_links
}

use tauri::{PhysicalPosition, PhysicalSize, Window, Emitter, Manager};
use serde::{Serialize, Deserialize};
use sysinfo::System;
use clipboard::{ClipboardProvider, ClipboardContext};

#[derive(Debug, Serialize, Deserialize)]
struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct ScreenshotOptions {
    format: Option<String>,
    quality: Option<u8>,
    path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FileOperationOptions {
    encoding: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PlatformInfo {
    os: String,
    arch: String,
    version: String,
    hostname: String,
    memory: MemoryInfo,
    cpu: CpuInfo,
    disk: DiskInfo,
}

#[derive(Debug, Serialize, Deserialize)]
struct MemoryInfo {
    total: u64,
    free: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct CpuInfo {
    cores: usize,
    frequency: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct DiskInfo {
    total: u64,
    free: u64,
}

// Basic Tauri Commands for testing
#[tauri::command]
async fn get_window_bounds(window: Window) -> Result<WindowBounds, String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    Ok(WindowBounds {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    })
}

#[tauri::command]
async fn set_window_bounds(window: Window, bounds: WindowBounds) -> Result<(), String> {
    window.set_position(PhysicalPosition::new(bounds.x, bounds.y)).map_err(|e| e.to_string())?;
    window.set_size(PhysicalSize::new(bounds.width, bounds.height)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn maximize_window(window: Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn unmaximize_window(window: Window) -> Result<(), String> {
    window.unmaximize().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn close_window(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn take_screenshot(_options: Option<ScreenshotOptions>) -> Result<String, String> {
    Ok("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string())
}

#[tauri::command]
async fn read_file(path: String, _options: Option<FileOperationOptions>) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

#[tauri::command]
async fn write_file(path: String, contents: String, _options: Option<FileOperationOptions>) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("Failed to write file '{}': {}", path, e))?;
    Ok(())
}

#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file '{}': {}", path, e))?;
    Ok(())
}

#[tauri::command]
async fn get_current_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_platform_info() -> Result<PlatformInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_memory = sys.total_memory();
    let free_memory = sys.free_memory();

    let total_disk = 1000000000u64;
    let free_disk = 500000000u64;

    Ok(PlatformInfo {
        os: System::name().unwrap_or_else(|| "Unknown".to_string()),
        arch: std::env::consts::ARCH.to_string(),
        version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".to_string()),
        memory: MemoryInfo {
            total: total_memory,
            free: free_memory,
        },
        cpu: CpuInfo {
            cores: sys.cpus().len(),
            frequency: sys.cpus().first().map(|c| c.frequency()).unwrap_or(0),
        },
        disk: DiskInfo {
            total: total_disk,
            free: free_disk,
        },
    })
}

#[tauri::command]
async fn read_clipboard() -> Result<String, String> {
    let mut ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
    ctx.get_contents().map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_clipboard(content: String) -> Result<(), String> {
    let mut ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
    ctx.set_contents(content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn generate_test_logs(app: tauri::AppHandle) -> Result<(), String> {
    let logs = [
        ("TRACE", "This is a TRACE level log"),
        ("DEBUG", "This is a DEBUG level log"),
        ("INFO", "This is an INFO level log"),
        ("WARN", "This is a WARN level log"),
        ("ERROR", "This is an ERROR level log"),
    ];

    for (level, message) in logs {
        // Emit to the main webview window (for frontend listener)
        let _ = app.emit("backend-log", &format!("[{}] {}", level, message));
        // Also print to stderr which tauri-driver captures
        eprintln!("[{}] {}", level, message);
    }

    Ok(())
}

#[tauri::command]
async fn get_deep_links(_app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let links = DEEP_LINKS.lock().map_err(|e| e.to_string())?.clone();
    eprintln!("🔍 get_deep_links() called - returning {} links: {:?}", links.len(), links);
    log_deep_link(&format!("get_deep_links called, returning {} links: {:?}", links.len(), links));
    Ok(links)
}

fn emit_deep_links<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let deep_links = DEEP_LINKS.lock().map(|guard| guard.clone()).unwrap_or_default();

    if !deep_links.is_empty() {
        eprintln!("📤 emit_deep_links() called - emitting {} deep links to frontend", deep_links.len());
        log_deep_link(&format!("Emitting {} deep links to frontend", deep_links.len()));
        for link in &deep_links {
            match app.emit("deeplink-received", link) {
                Ok(_) => {
                    eprintln!("  ✓ Emitted: {}", link);
                    log_deep_link(&format!("Emitted deep link: {}", link));
                },
                Err(e) => {
                    eprintln!("  ✗ ERROR emitting {}: {}", link, e);
                    log_deep_link(&format!("ERROR emitting deep link {}: {}", link, e));
                }
            }
        }
    } else {
        log_deep_link("emit_deep_links() called but no deep links to emit");
    }
}

fn create_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::WebviewWindow<R> {
    log_deep_link("create_main_window() called");
    eprintln!("[Tauri-DEBUG] create_main_window called");
    if let Some(existing) = app.get_webview_window("main") {
        log_deep_link("Found existing main window, returning it");
        eprintln!("[Tauri-DEBUG] Found existing main window, returning it");
        return existing;
    }
    log_deep_link("No existing window found, creating new main window...");
    eprintln!("[Tauri-DEBUG] Creating new main window");
    let window = tauri::WebviewWindowBuilder::new(
        app,
        "main",
        tauri::WebviewUrl::App("index.html".into())
    )
    .title("Tauri E2E Test App")
    .inner_size(600.0, 400.0)
    .build()
    .expect("Failed to create main window");
    log_deep_link("Main window created successfully");
    eprintln!("[Tauri-DEBUG] Main window created successfully");
    window
}

#[tauri::command]
async fn switch_to_main(app: tauri::AppHandle) -> Result<(), String> {
    eprintln!("[Tauri-DEBUG] switch_to_main called");

    // Standard Tauri splashscreen transition:
    // Both windows exist, just switch visibility

    let main = app.get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    // Hide splash (keeps WebDriver session alive)
    if let Some(splash) = app.get_webview_window("splash") {
        eprintln!("[Tauri-DEBUG] Hiding splash window");
        splash.hide().map_err(|e| e.to_string())?;
    }

    // Show and focus main
    eprintln!("[Tauri-DEBUG] Showing main window");
    main.show().map_err(|e| e.to_string())?;
    main.set_focus().map_err(|e| e.to_string())?;

    eprintln!("[Tauri-DEBUG] switch_to_main completed - session stays valid!");
    Ok(())
}

fn main() {
    log_deep_link(&format!("=== APP STARTING ==="));
    log_deep_link(&format!("PID: {}", std::process::id()));
    log_deep_link(&format!("App starting with {} args", std::env::args().count()));
    log_deep_link(&format!("CI mode: {}", std::env::var("CI").unwrap_or_else(|_| "not set".to_string())));
    log_deep_link(&format!("Working directory: {:?}", std::env::current_dir()));

    // DEBUG: Print ALL args to diagnose deep link routing
    let all_args: Vec<String> = std::env::args().collect();
    eprintln!("[DEEPLINK-DEBUG] All args: {:?}", all_args);
    log_deep_link(&format!("CLI args: {:?}", all_args));

    // Check for deep link URLs in args
    for (i, arg) in all_args.iter().enumerate() {
        if arg.starts_with("testapp://") {
            eprintln!("[DEEPLINK-DEBUG] Found deep link at index {}: {}", i, arg);
            log_deep_link(&format!("DEEP-LINK-RECEIVED-VIA-CLI: {} (index {})", arg, i));
        }
    }

    let is_splash = std::env::var("ENABLE_SPLASH_WINDOW").is_ok();
    eprintln!("[Tauri-DEBUG] ENABLE_SPLASH_WINDOW={}", is_splash);
    log_deep_link(&format!("ENABLE_SPLASH_WINDOW={}", is_splash));

    // Conditionally enable single-instance plugin (only for deeplink tests)
    // This prevents conflicts when multiple workers run in parallel for other test types
    let enable_single_instance = std::env::var("ENABLE_SINGLE_INSTANCE").is_ok();
    log_deep_link(&format!("ENABLE_SINGLE_INSTANCE={}", enable_single_instance));
    log_deep_link(&format!("Single-instance plugin will be enabled: {}", enable_single_instance));

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_wdio::init());

    // Add single-instance plugin only when explicitly enabled (deeplink tests)
    if enable_single_instance {
        log_deep_link("Initializing single-instance plugin...");
        eprintln!("======================================");
        eprintln!("SINGLE-INSTANCE PLUGIN ENABLED");
        eprintln!("======================================");

        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            eprintln!("");
            eprintln!("╔════════════════════════════════════════════════════════════════╗");
            eprintln!("║ SINGLE-INSTANCE CALLBACK TRIGGERED!                           ║");
            eprintln!("╚════════════════════════════════════════════════════════════════╝");
            eprintln!("  Second instance attempted to start");
            eprintln!("  CWD: {:?}", cwd);
            eprintln!("  Args count: {}", args.len());
            eprintln!("  Args: {:?}", args);
            eprintln!("");

            log_deep_link(&format!("🔔 Single-instance callback triggered! Args: {:?}, CWD: {:?}", args, cwd));

            // Forward deep links from second instance to the running instance
            let mut deeplink_count = 0;
            for (i, arg) in args.iter().enumerate() {
                log_deep_link(&format!("  Processing arg[{}]: {}", i, arg));
                if arg.starts_with("testapp://") {
                    deeplink_count += 1;
                    eprintln!("  ✓ Found deeplink at arg[{}]: {}", i, arg);
                    log_deep_link(&format!("🔗 Single-instance forwarding deeplink: {}", arg));

                    // Add to deep links collection
                    if let Ok(mut links) = DEEP_LINKS.lock() {
                        links.push(arg.clone());
                        log_deep_link(&format!("  ✓ Added to DEEP_LINKS collection (total: {})", links.len()));
                    }

                    // Emit to frontend
                    match app.emit("deeplink-received", arg) {
                        Ok(_) => {
                            eprintln!("  ✓ Emitted deeplink event to frontend: {}", arg);
                            log_deep_link(&format!("✅ Successfully emitted deeplink to frontend: {}", arg));
                        },
                        Err(e) => {
                            eprintln!("  ✗ ERROR emitting deeplink: {}", e);
                            log_deep_link(&format!("❌ ERROR emitting deeplink: {}", e));
                        }
                    }
                } else {
                    log_deep_link(&format!("  ⊘ Arg does not start with testapp://, skipping: {}", arg));
                }
            }

            eprintln!("");
            if deeplink_count > 0 {
                eprintln!("  Summary: Forwarded {} deeplink(s) to running instance", deeplink_count);
            } else {
                eprintln!("  Summary: No deeplinks found in args");
            }
            eprintln!("╚════════════════════════════════════════════════════════════════╝");
            eprintln!("");
        }));

        log_deep_link("Single-instance plugin initialized successfully");
        eprintln!("✓ Single-instance plugin registered");
        eprintln!("  Waiting for second instance attempts...");
        eprintln!("======================================");
    }

    log_deep_link("Building Tauri app...");
    
    builder
        .plugin(tauri_plugin_deep_link::init())
        .setup(move |app| {
            log_deep_link("=== TAURI SETUP STARTING ===");
            eprintln!("[Tauri-DEBUG] Setup called, is_splash={}", is_splash);
            log_deep_link(&format!("Setup called, is_splash={}", is_splash));

            // Collect deep links from CLI args at startup
            let cli_deep_links = collect_deep_links_from_args();
            if !cli_deep_links.is_empty() {
                eprintln!("");
                eprintln!("🔗 Found {} deep links in CLI args at startup:", cli_deep_links.len());
                log_deep_link(&format!("Found {} deep links in CLI args", cli_deep_links.len()));
                let mut deep_links_guard = DEEP_LINKS.lock().unwrap();
                for link in &cli_deep_links {
                    eprintln!("  - {}", link);
                    deep_links_guard.push(link.clone());
                    log_deep_link(&format!("Collected deep link: {}", link));
                }
                drop(deep_links_guard);

                eprintln!("  Emitting to frontend...");
                // Emit deep links to frontend
                emit_deep_links(&app.handle());
                eprintln!("");
            } else {
                log_deep_link("No deep links found in CLI args at startup");
            }

            // Register deeplink protocol at runtime (Linux/Windows only)
            // This is needed for development/testing when the protocol handler
            // hasn't been registered by the installer
            #[cfg(any(target_os = "linux", target_os = "windows"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                // Get CURRENT binary path for debugging
                let binary_path = std::env::current_exe()
                    .expect("Failed to get current binary path");
                log_deep_link(&format!("Current binary path: {:?}", binary_path));

                // Register protocol - the plugin automatically uses current binary
                // This fixes CI path mismatches where register_all() points to wrong binary
                match app.deep_link().register("testapp") {
                    Ok(_) => {
                        eprintln!("[Tauri-DEBUG] Successfully registered testapp protocol");
                        log_deep_link("✓ Registered testapp protocol");
                    }
                    Err(e) => {
                        eprintln!("[Tauri-DEBUG] Protocol registration failed (non-fatal): {}", e);
                        log_deep_link(&format!("Protocol registration note: {}. Deep links still work via CLI args.", e));
                    }
                }

                log_deep_link("Deep links arrive via CLI args on Linux (receiver not used)");
            }

            if is_splash {
                // 1. SPLASH FIRST - WebDriver MUST connect here (visible + focused)
                log_deep_link("Creating SPLASH window (ENABLE_SPLASH_WINDOW=true)");
                eprintln!("[Tauri-DEBUG] === Creating SPLASH window FIRST ===");
                let splash = tauri::WebviewWindowBuilder::new(
                    app,
                    "splash",
                    tauri::WebviewUrl::App("splash.html".into())
                )
                .title("Splash Screen")
                .inner_size(300.0, 200.0)
                .resizable(false)
                .decorations(false)
                .focused(true)           // CRITICAL: WebDriver attaches here
                .build()
                .expect("Failed to create splash window");

                // Show/focus splash explicitly (ensures WebDriver session)
                splash.show().expect("Failed to show splash");
                splash.set_focus().expect("Failed to focus splash");

                eprintln!("[Tauri-DEBUG] ✓ Splash created and focused");
                log_deep_link("Splash window created and focused successfully");

                // 2. MAIN SECOND - hidden until switch_to_main
                log_deep_link("Creating MAIN window (hidden)");
                eprintln!("[Tauri-DEBUG] === Creating MAIN window SECOND (hidden) ===");
                let _main = tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into())
                )
                .title("Tauri E2E Test App")
                .inner_size(600.0, 400.0)
                .visible(false)          // HIDDEN until switch_to_main
                .build()
                .expect("Failed to create main window");

                eprintln!("[Tauri-DEBUG] ✓ Main created (hidden). Ready for switch_to_main!");
                log_deep_link("Main window created (hidden) successfully");
            } else {
                // No splash - just main window (unchanged)
                log_deep_link("No splash mode - creating main window only");
                eprintln!("[Tauri-DEBUG] No splash mode - creating main only");
                create_main_window(app.handle());
                log_deep_link("Main window created successfully");
            }
            log_deep_link("=== TAURI SETUP COMPLETED SUCCESSFULLY ===");
            Ok::<(), Box<dyn std::error::Error>>(())
        })
        .invoke_handler(tauri::generate_handler![
            get_window_bounds,
            set_window_bounds,
            minimize_window,
            maximize_window,
            unmaximize_window,
            close_window,
            take_screenshot,
            read_file,
            write_file,
            delete_file,
            get_current_dir,
            get_platform_info,
            read_clipboard,
            write_clipboard,
            generate_test_logs,
            switch_to_main,
            get_deep_links,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    
    log_deep_link("=== APP EXITED ===");
}

