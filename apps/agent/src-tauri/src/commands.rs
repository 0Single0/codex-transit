use std::{path::PathBuf, sync::Mutex};

use tauri::State;

use crate::project_registry::{ProjectEntry, ProjectRegistry};

pub struct AgentState {
    pub projects: Mutex<ProjectRegistry>
}

#[tauri::command]
pub fn add_project(path: String, state: State<AgentState>) -> Result<ProjectEntry, String> {
    let mut projects = state
        .projects
        .lock()
        .map_err(|_| "project registry locked".to_string())?;
    projects.add_project(PathBuf::from(path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_projects(state: State<AgentState>) -> Result<Vec<ProjectEntry>, String> {
    let projects = state
        .projects
        .lock()
        .map_err(|_| "project registry locked".to_string())?;
    Ok(projects.list())
}
