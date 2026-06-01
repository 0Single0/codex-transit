pub mod agent_config;
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

use commands::{
    add_project, get_agent_runtime_status, get_agent_settings, list_projects, save_agent_settings,
    start_agent_runtime, stop_agent_runtime, sync_projects_now, AgentState,
};

pub fn run() {
    tauri::Builder::default()
        .manage(AgentState::default())
        .invoke_handler(tauri::generate_handler![
            add_project,
            list_projects,
            save_agent_settings,
            get_agent_settings,
            sync_projects_now,
            start_agent_runtime,
            stop_agent_runtime,
            get_agent_runtime_status
        ])
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("failed to run Codex Transit Agent");
}
