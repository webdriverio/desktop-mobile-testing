use std::fs::OpenOptions;
use std::io::Write;

pub fn write_diagnostic(message: &str) {
    let path = "/tmp/tauri-log-diagnostic.txt";
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "[{}] {}", chrono::Local::now().format("%H:%M:%S%.3f"), message);
    }
}
