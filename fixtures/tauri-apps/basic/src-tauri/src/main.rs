// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{PhysicalPosition, PhysicalSize, Window};
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
    // For now, return a placeholder base64 string
    // In a real implementation, you would use a screenshot library
    Ok("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string())
}

#[tauri::command]
async fn read_file(path: String, _options: Option<FileOperationOptions>) -> Result<String, String> {
    let log_msg = format!("🔍 Rust: read_file called with path: '{}'\n", path);
    let _ = std::fs::write("/tmp/tauri-debug.log", log_msg.as_bytes());
    println!("🔍 Rust: read_file called with path: '{}'", path);

    let result = std::fs::read_to_string(&path).map_err(|e| {
        let error_msg = format!("Failed to read file '{}': {}", path, e);
        let log_msg = format!("🔍 Rust: read_file error: {}\n", error_msg);
        let _ = std::fs::write("/tmp/tauri-debug.log", log_msg.as_bytes());
        error_msg
    });
    if result.is_ok() {
        let log_msg = format!("🔍 Rust: read_file succeeded for path: '{}', content length: {}\n", path, result.as_ref().unwrap().len());
        let _ = std::fs::write("/tmp/tauri-debug.log", log_msg.as_bytes());
    }
    result
}

#[tauri::command]
async fn write_file(path: String, contents: String, _options: Option<FileOperationOptions>) -> Result<(), String> {
    let log_msg = format!("🔍 Rust: write_file called with path: '{}', contents length: {}\n", path, contents.len());
    let _ = std::fs::write("/tmp/tauri-debug.log", log_msg.as_bytes());
    println!("🔍 Rust: write_file called with path: '{}', contents length: {}", path, contents.len());

    std::fs::write(&path, contents).map_err(|e| {
        let error_msg = format!("Failed to write file '{}': {}", path, e);
        let log_msg = format!("🔍 Rust: write_file error: {}\n", error_msg);
        let _ = std::fs::write("/tmp/tauri-debug.log", log_msg.as_bytes());
        error_msg
    })?;

    let log_msg = format!("🔍 Rust: write_file succeeded for path: '{}'\n", path);
    let _ = std::fs::write("/tmp/tauri-debug.log", log_msg.as_bytes());
    Ok(())
}

#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    let log_msg = format!("🔍 Rust: delete_file called with path: '{}'\n", path);
    let _ = std::fs::write("/tmp/tauri-debug.log", log_msg.as_bytes());
    println!("🔍 Rust: delete_file called with path: '{}'", path);

    std::fs::remove_file(&path).map_err(|e| {
        let error_msg = format!("Failed to delete file '{}': {}", path, e);
        let log_msg = format!("🔍 Rust: delete_file error: {}\n", error_msg);
        let _ = std::fs::write("/tmp/tauri-debug.log", log_msg.as_bytes());
        error_msg
    })?;

    let log_msg = format!("🔍 Rust: delete_file succeeded for path: '{}'\n", path);
    let _ = std::fs::write("/tmp/tauri-debug.log", log_msg.as_bytes());
    Ok(())
}

#[tauri::command]
async fn get_current_dir() -> Result<String, String> {
    println!("🔍 Rust: get_current_dir called");
    let _ = std::fs::write("/tmp/tauri-debug.log", "🔍 Rust: get_current_dir called\n");
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

    // Simplified disk info - just return placeholder values for now
    let total_disk = 1000000000u64; // 1GB placeholder
    let free_disk = 500000000u64;   // 500MB placeholder

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

fn main() {
    let _ = std::fs::write("/tmp/tauri-debug.log", "🔍 Rust: Tauri v2 app starting...\n");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
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
            write_clipboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
