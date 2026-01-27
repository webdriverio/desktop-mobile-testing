// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// NOTE: This also detaches stdout/stderr in release mode on Windows, preventing log capture.
// E2E tests use debug builds on Windows to preserve stdout/stderr for logging tests.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

fn create_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::WebviewWindow<R> {
    tauri::WebviewWindowBuilder::new(
        app,
        "main",
        tauri::WebviewUrl::App("index.html".into())
    )
    .title("Tauri E2E Test App")
    .inner_size(600.0, 400.0)
    .build()
    .expect("Failed to create main window")
}

#[tauri::command]
async fn switch_to_main(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splash") {
        splash.hide().map_err(|e| e.to_string())?;
    }

    let main = app.get_webview_window("main")
        .unwrap_or_else(|| create_main_window(&app));

    main.show().map_err(|e| e.to_string())?;
    main.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_wdio::init())
        .setup(|app| {
            let is_splash = std::env::var("ENABLE_SPLASH_WINDOW").is_ok();

            if is_splash {
                let _splash = tauri::WebviewWindowBuilder::new(
                    app,
                    "splash",
                    tauri::WebviewUrl::App("splash.html".into())
                )
                .title("Splash Screen")
                .inner_size(300.0, 200.0)
                .resizable(false)
                .decorations(false)
                .transparent(true)
                .build()
                .expect("Failed to create splash window");

                create_main_window(app.handle());
            } else {
                create_main_window(app.handle());
            }

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
