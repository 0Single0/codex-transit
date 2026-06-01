use std::{path::PathBuf, sync::Mutex};

use tauri::State;

use crate::{
    agent_config::{AgentConfig, AgentSettings},
    project_registry::{ProjectEntry, ProjectRegistry},
    project_sync::{sync_projects_from_registry, ProjectSyncRequest},
};

pub struct AgentState {
    pub projects: Mutex<ProjectRegistry>,
    pub config: Mutex<AgentConfig>,
}

impl Default for AgentState {
    fn default() -> Self {
        Self {
            projects: Mutex::new(ProjectRegistry::default()),
            config: Mutex::new(AgentConfig::default()),
        }
    }
}

#[tauri::command]
pub fn add_project(path: String, state: State<AgentState>) -> Result<ProjectEntry, String> {
    let mut projects = state
        .projects
        .lock()
        .map_err(|_| "project registry locked".to_string())?;
    projects
        .add_project(PathBuf::from(path))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_projects(state: State<AgentState>) -> Result<Vec<ProjectEntry>, String> {
    let projects = state
        .projects
        .lock()
        .map_err(|_| "project registry locked".to_string())?;
    Ok(projects.list())
}

pub fn save_agent_settings_in_state(
    state: &AgentState,
    settings: AgentSettings,
) -> Result<(), String> {
    let mut config = state
        .config
        .lock()
        .map_err(|_| "agent config locked".to_string())?;
    config.update(settings);
    Ok(())
}

pub fn get_saved_agent_settings(state: &AgentState) -> Result<Option<AgentSettings>, String> {
    let config = state
        .config
        .lock()
        .map_err(|_| "agent config locked".to_string())?;
    Ok(config.get())
}

#[tauri::command]
pub fn save_agent_settings(
    settings: AgentSettings,
    state: State<AgentState>,
) -> Result<(), String> {
    save_agent_settings_in_state(&state, settings)
}

#[tauri::command]
pub fn get_agent_settings(state: State<AgentState>) -> Result<Option<AgentSettings>, String> {
    get_saved_agent_settings(&state)
}

pub fn build_project_sync_request_from_state(
    state: &AgentState,
) -> Result<ProjectSyncRequest, String> {
    let settings =
        get_saved_agent_settings(state)?.ok_or_else(|| "agent is not configured".to_string())?;
    let projects = state
        .projects
        .lock()
        .map_err(|_| "project registry locked".to_string())?
        .list();
    sync_projects_from_registry(&settings, projects).map_err(|error| error.to_string())
}
