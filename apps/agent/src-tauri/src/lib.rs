pub mod agent_runtime;
pub mod codex_adapter;
pub mod commands;
pub mod diff_provider;
pub mod file_watcher;
pub mod path_guard;
pub mod project_registry;
pub mod project_sync;
pub mod protocol;
pub mod server_client;
pub mod session_manager;

use commands::{add_project, list_projects, AgentState};
use project_registry::ProjectRegistry;
use std::sync::Mutex;

pub fn run() {
    tauri::Builder::default()
        .manage(AgentState {
            projects: Mutex::new(ProjectRegistry::default())
        })
        .invoke_handler(tauri::generate_handler![add_project, list_projects])
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("failed to run Codex Transit Agent");
}
