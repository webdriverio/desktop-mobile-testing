const COMMANDS: &[&str] = &[
    "execute",
    "set_mock",
    "get_mock",
    "clear_mocks",
    "reset_mocks",
    "restore_mocks",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}

