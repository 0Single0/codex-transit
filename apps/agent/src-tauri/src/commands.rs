use std::{path::PathBuf, sync::Mutex};

use serde::{Deserialize, Serialize};
use tokio::{sync::{mpsc, oneshot}, task::JoinHandle};
use tauri::State;

use crate::{
    agent_runtime::run_agent_loop,
    agent_config::{AgentConfig, AgentSettings},
    file_watcher::FileWatcher,
    project_registry::{ProjectEntry, ProjectRegistry},
    project_sync::{sync_projects_from_registry, ProjectSyncHttpClient, ProjectSyncRequest},
    server_client::{AgentRealtimeConfig, ServerClient},
    session_manager::SessionManager,
};

pub struct AgentState {
    pub projects: Mutex<ProjectRegistry>,
    pub config: Mutex<AgentConfig>,
    pub runtime: Mutex<AgentRuntimeState>,
}

impl Default for AgentState {
    fn default() -> Self {
        Self {
            projects: Mutex::new(ProjectRegistry::default()),
            config: Mutex::new(AgentConfig::default()),
            runtime: Mutex::new(AgentRuntimeState::default()),
        }
    }
}

#[derive(Default)]
pub struct AgentRuntimeState {
    running: bool,
    shutdown_tx: Option<oneshot::Sender<()>>,
    task: Option<JoinHandle<()>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeStatus {
    pub running: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AgentRuntimeStartup {
    pub url: String,
}

struct RuntimeLaunch {
    startup: AgentRuntimeStartup,
    shutdown_rx: oneshot::Receiver<()>,
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

#[tauri::command]
pub async fn sync_projects_now(state: State<'_, AgentState>) -> Result<(), String> {
    let request = build_project_sync_request_from_state(&state)?;
    ProjectSyncHttpClient::send(request)
        .await
        .map_err(|error| error.to_string())
}

pub fn build_realtime_config_from_state(state: &AgentState) -> Result<AgentRealtimeConfig, String> {
    let settings =
        get_saved_agent_settings(state)?.ok_or_else(|| "agent is not configured".to_string())?;
    AgentRealtimeConfig::from_settings(&settings).map_err(|error| error.to_string())
}

fn reserve_agent_runtime_start(state: &AgentState) -> Result<RuntimeLaunch, String> {
    let realtime = build_realtime_config_from_state(state)?;
    let mut runtime = state
        .runtime
        .lock()
        .map_err(|_| "agent runtime locked".to_string())?;
    if runtime.running {
        return Err("agent runtime is already running".to_string());
    }
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    runtime.running = true;
    runtime.shutdown_tx = Some(shutdown_tx);
    Ok(AgentRuntimeStartup {
        url: realtime.url.to_string(),
    }
    .into_launch(shutdown_rx))
}

pub fn start_agent_runtime_in_state(state: &AgentState) -> Result<AgentRuntimeStartup, String> {
    let launch = reserve_agent_runtime_start(state)?;
    Ok(launch.startup)
}

impl AgentRuntimeStartup {
    fn into_launch(self, shutdown_rx: oneshot::Receiver<()>) -> RuntimeLaunch {
        RuntimeLaunch {
            startup: self,
            shutdown_rx,
        }
    }
}

fn store_agent_runtime_task(state: &AgentState, task: JoinHandle<()>) -> Result<(), String> {
    let mut runtime = state
        .runtime
        .lock()
        .map_err(|_| "agent runtime locked".to_string())?;
    runtime.task = Some(task);
    Ok(())
}

fn spawn_agent_runtime_task(
    realtime: AgentRealtimeConfig,
    projects: Vec<ProjectEntry>,
    shutdown_rx: oneshot::Receiver<()>,
) -> Result<JoinHandle<()>, String> {
    let (server_outbound_tx, server_outbound_rx) = mpsc::channel(256);
    let (server_inbound_tx, mut server_inbound_rx) = mpsc::channel(256);
    let (file_change_tx, mut file_change_rx) = mpsc::channel(256);
    let mut manager = SessionManager::default_codex();
    let mut watchers = Vec::new();

    for project in projects {
        manager.register_project(project.project_id, project.root.clone());
        watchers.push(
            FileWatcher::watch_changes(project.project_id, project.root, file_change_tx.clone())
                .map_err(|error| error.to_string())?,
        );
    }

    let server_client = ServerClient::new(realtime.url.to_string());
    let task = tokio::spawn(async move {
        let connection = tokio::spawn(async move {
            if let Err(error) = server_client
                .connect(server_outbound_rx, server_inbound_tx)
                .await
            {
                eprintln!("agent realtime connection stopped: {error}");
            }
        });

        let result = run_agent_loop(
            &mut manager,
            &mut server_inbound_rx,
            &server_outbound_tx,
            &mut file_change_rx,
            shutdown_rx,
        )
        .await;
        connection.abort();
        drop(watchers);
        if let Err(error) = result {
            eprintln!("agent runtime loop stopped: {error}");
        }
    });
    Ok(task)
}

pub fn mark_agent_runtime_stopped(state: &AgentState) -> Result<(), String> {
    let mut runtime = state
        .runtime
        .lock()
        .map_err(|_| "agent runtime locked".to_string())?;
    if let Some(shutdown_tx) = runtime.shutdown_tx.take() {
        let _ = shutdown_tx.send(());
    }
    if let Some(task) = runtime.task.take() {
        task.abort();
    }
    runtime.running = false;
    Ok(())
}

pub fn get_agent_runtime_status_from_state(
    state: &AgentState,
) -> Result<AgentRuntimeStatus, String> {
    let runtime = state
        .runtime
        .lock()
        .map_err(|_| "agent runtime locked".to_string())?;
    Ok(AgentRuntimeStatus {
        running: runtime.running,
    })
}

#[tauri::command]
pub async fn start_agent_runtime(state: State<'_, AgentState>) -> Result<AgentRuntimeStatus, String> {
    let realtime = build_realtime_config_from_state(&state)?;
    let projects = state
        .projects
        .lock()
        .map_err(|_| "project registry locked".to_string())?
        .list();
    let launch = reserve_agent_runtime_start(&state)?;
    let task = match spawn_agent_runtime_task(realtime, projects, launch.shutdown_rx) {
        Ok(task) => task,
        Err(error) => {
            mark_agent_runtime_stopped(&state)?;
            return Err(error);
        }
    };
    store_agent_runtime_task(&state, task)?;
    get_agent_runtime_status_from_state(&state)
}

#[tauri::command]
pub fn stop_agent_runtime(state: State<AgentState>) -> Result<AgentRuntimeStatus, String> {
    mark_agent_runtime_stopped(&state)?;
    get_agent_runtime_status_from_state(&state)
}

#[tauri::command]
pub fn get_agent_runtime_status(state: State<AgentState>) -> Result<AgentRuntimeStatus, String> {
    get_agent_runtime_status_from_state(&state)
}
