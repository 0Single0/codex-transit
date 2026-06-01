pub mod codex_adapter;
pub mod file_watcher;
pub mod path_guard;
pub mod project_registry;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("failed to run Codex Transit Agent");
}
