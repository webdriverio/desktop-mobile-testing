use std::env;
use std::fs;
use std::path::Path;

const COMMANDS: &[&str] = &[
    "wdio.execute",
    "wdio.set-mock",
    "wdio.get-mock",
    "wdio.clear-mocks",
    "wdio.reset-mocks",
    "wdio.restore-mocks",
];

fn main() {
    // During cargo publish, ensure we use a proper directory that's included in the package
    // If this is a publish build, the environment variable CARGO_FEATURE_BEING_PACKAGED is set
    if std::env::var("CARGO_FEATURE_BEING_PACKAGED").is_ok() {
        // Set the generation directory to a standard location during packaging
        let out_dir = std::env::var("OUT_DIR").unwrap_or_else(|_| "target/package".to_string());
        std::env::set_var("TAURI_BUILD_GEN_DIR", out_dir);
    }

    // Register plugin commands
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .plugin(
                "wdio",
                tauri_build::InlinedPlugin::new()
                    .commands(&COMMANDS)
            )
    )
    .unwrap_or_else(|_| {
        println!("cargo:warning=Failed to build with tauri.conf.json, skipping config verification");
    });

    // CRITICAL: Copy permissions directory to OUT_DIR/permissions/wdio/ so Tauri can find and merge them into ACL manifest
    // The permissions must be in a subdirectory matching the plugin name ("wdio") for Tauri to recognize them
    // This is required for plugin permissions to appear in the generated ACL manifest
    let out_dir = env::var("OUT_DIR").expect("OUT_DIR not set");
    let perm_src = Path::new("permissions");
    // IMPORTANT: Must be OUT_DIR/permissions/wdio/ to match the plugin name registered above
    let perm_dest = Path::new(&out_dir).join("permissions").join("wdio");

    // Tell Cargo to rerun this build script if permissions change
    println!("cargo:rerun-if-changed=permissions/");

    if perm_src.exists() {
        fs::create_dir_all(&perm_dest).expect("Failed to create permissions output directory");

        for entry in fs::read_dir(perm_src).expect("Failed to read permissions directory") {
            let entry = entry.expect("Failed to read permissions directory entry");
            let dest_path = perm_dest.join(entry.file_name());
            fs::copy(entry.path(), dest_path).expect("Failed to copy permissions file");
        }
    }
}

