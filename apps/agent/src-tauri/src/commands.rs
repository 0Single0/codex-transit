use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Mutex},
};

use serde::{Deserialize, Serialize};
use tokio::{sync::{mpsc, oneshot}, task::JoinHandle};
use tauri::State;

use crate::{
    agent_runtime::run_agent_loop,
    agent_config::{AgentConfig, AgentSettings},
    file_watcher::FileWatcher,
    provider_models::fetch_provider_models,
    project_registry::{ProjectEntry, ProjectRegistry},
    project_sync::{
        build_device_bind_request, sync_projects_from_registry, DeviceBindHttpClient,
        DeviceBindRequestInput, ProjectSyncHttpClient, ProjectSyncRequest,
    },
    server_client::{AgentRealtimeConfig, ServerClient},
    session_manager::SessionManager,
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDeviceOverview {
    pub name: String,
    pub platform: String,
    pub os_label: String,
    pub version: String,
}

pub struct AgentState {
    pub projects: Mutex<ProjectRegistry>,
    pub config: Mutex<AgentConfig>,
    pub runtime: Arc<Mutex<AgentRuntimeState>>,
    storage: AgentStorage,
}

impl Default for AgentState {
    fn default() -> Self {
        let storage = AgentStorage::default();
        Self {
            projects: Mutex::new(
                ProjectRegistry::load_from_file(&storage.projects_path).unwrap_or_default(),
            ),
            config: Mutex::new(AgentConfig::load_from_file(&storage.settings_path).unwrap_or_default()),
            runtime: Arc::new(Mutex::new(AgentRuntimeState::default())),
            storage,
        }
    }
}

#[derive(Clone)]
pub struct AgentStorage {
    settings_path: PathBuf,
    projects_path: PathBuf,
}

impl Default for AgentStorage {
    fn default() -> Self {
        Self::new(default_storage_dir())
    }
}

impl AgentStorage {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        let root = root.into();
        Self {
            settings_path: root.join("settings.json"),
            projects_path: root.join("projects.json"),
        }
    }
}

fn default_storage_dir() -> PathBuf {
    std::env::var_os("CODEX_TRANSIT_AGENT_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::var_os("APPDATA")
                .map(PathBuf::from)
                .or_else(|| std::env::var_os("HOME").map(PathBuf::from))
                .unwrap_or_else(std::env::temp_dir)
                .join("codex-transit-agent")
        })
}

impl AgentState {
    pub fn with_storage(root: impl AsRef<Path>) -> Self {
        let storage = AgentStorage::new(root.as_ref());
        Self {
            projects: Mutex::new(
                ProjectRegistry::load_from_file(&storage.projects_path).unwrap_or_default(),
            ),
            config: Mutex::new(AgentConfig::load_from_file(&storage.settings_path).unwrap_or_default()),
            runtime: Arc::new(Mutex::new(AgentRuntimeState::default())),
            storage,
        }
    }
}

#[derive(Default)]
pub struct AgentRuntimeState {
    running: bool,
    connected: bool,
    last_error: Option<String>,
    recent_commands: Vec<AgentCommandLogEntry>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    task: Option<JoinHandle<()>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeStatus {
    pub running: bool,
    pub connected: bool,
    pub last_error: Option<String>,
    pub recent_commands: Vec<AgentCommandLogEntry>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCommandLogEntry {
    pub item_id: String,
    pub command: String,
    pub status: String,
    pub output: Option<String>,
    pub exit_code: Option<i32>,
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
    let entry = projects
        .add_project(PathBuf::from(path))
        .map_err(|error| error.to_string())?;
    projects
        .save_to_file(&state.storage.projects_path)
        .map_err(|error| error.to_string())?;
    Ok(entry)
}

#[tauri::command]
pub fn remove_project(project_id: uuid::Uuid, state: State<AgentState>) -> Result<(), String> {
    let mut projects = state
        .projects
        .lock()
        .map_err(|_| "project registry locked".to_string())?;
    projects
        .remove_project(&project_id)
        .ok_or_else(|| "project not found".to_string())?;
    projects
        .save_to_file(&state.storage.projects_path)
        .map_err(|error| error.to_string())?;
    Ok(())
}


#[tauri::command]
pub fn choose_project_directory() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn list_projects(state: State<AgentState>) -> Result<Vec<ProjectEntry>, String> {
    let projects = state
        .projects
        .lock()
        .map_err(|_| "project registry locked".to_string())?;
    Ok(projects.list())
}

#[tauri::command]
pub fn get_device_overview() -> AgentDeviceOverview {
    let platform = std::env::consts::OS.to_string();
    let name = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "Desktop Agent".to_string());
    let os_label = detect_os_label().unwrap_or_else(|| match std::env::consts::OS {
        "windows" => "Windows".to_string(),
        "macos" => "macOS".to_string(),
        "linux" => "Linux".to_string(),
        other => other.to_string(),
    });

    AgentDeviceOverview {
        name,
        platform,
        os_label,
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

fn detect_os_label() -> Option<String> {
    match std::env::consts::OS {
        "windows" => command_stdout(
            "powershell.exe",
            &[
                "-NoProfile",
                "-Command",
                "$caption=(Get-CimInstance Win32_OperatingSystem).Caption; [BitConverter]::ToString([Text.Encoding]::Unicode.GetBytes($caption)) -replace '-'",
            ],
        )
        .and_then(|hex| decode_utf16le_hex(&hex)),
        "macos" => {
            let name = command_stdout("sw_vers", &["-productName"])?;
            let version = command_stdout("sw_vers", &["-productVersion"])?;
            Some(format!("{name} {version}"))
        }
        "linux" => linux_pretty_name(),
        _ => None,
    }
}

fn decode_utf16le_hex(hex: &str) -> Option<String> {
    let compact: String = hex.chars().filter(|value| !value.is_whitespace()).collect();
    if compact.len() % 4 != 0 {
        return None;
    }
    let bytes = (0..compact.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&compact[index..index + 2], 16).ok())
        .collect::<Option<Vec<_>>>()?;
    let words = bytes
        .chunks_exact(2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .collect::<Vec<_>>();
    String::from_utf16(&words).ok()
}

fn command_stdout(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn linux_pretty_name() -> Option<String> {
    let body = fs::read_to_string("/etc/os-release").ok()?;
    for line in body.lines() {
        let Some(value) = line.strip_prefix("PRETTY_NAME=") else {
            continue;
        };
        return Some(value.trim_matches('"').to_string());
    }
    None
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
    config
        .save_to_file(&state.storage.settings_path)
        .map_err(|error| error.to_string())?;
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

#[tauri::command]
pub fn clear_agent_settings(state: State<AgentState>) -> Result<(), String> {
    mark_agent_runtime_stopped(&state)?;
    let mut config = state
        .config
        .lock()
        .map_err(|_| "agent config locked".to_string())?;
    *config = AgentConfig::default();
    if state.storage.settings_path.exists() {
        fs::remove_file(&state.storage.settings_path).map_err(|error| error.to_string())?;
    }
    Ok(())
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

pub async fn bind_device_in_state(
    state: &AgentState,
    request: DeviceBindRequestInput,
) -> Result<AgentSettings, String> {
    let bind_request = build_device_bind_request(
        &request.server_url,
        &request.bind_code,
        &request.name,
        &request.platform,
    )
    .map_err(|error| error.to_string())?;
    let response = DeviceBindHttpClient::send(bind_request)
        .await
        .map_err(|error| error.to_string())?;
    let settings = AgentSettings {
        server_url: request.server_url,
        device_id: response.device_id,
        device_token: response.token,
    };
    save_agent_settings_in_state(state, settings.clone())?;
    Ok(settings)
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
    runtime.connected = false;
    runtime.last_error = None;
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
    runtime_state: Arc<Mutex<AgentRuntimeState>>,
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
    let device_id = realtime.device_id.parse().ok();
    let runtime_for_connection = runtime_state.clone();
    let task = tokio::spawn(async move {
        let (connected_tx, connected_rx) = oneshot::channel();
        let connection = tokio::spawn(async move {
            let result = server_client
                .connect(server_outbound_rx, server_inbound_tx, Some(connected_tx))
                .await
                .map_err(|error| error.to_string());
            if let Err(error) = &result {
                eprintln!("agent realtime connection stopped: {error}");
            }
            let _ = mark_agent_runtime_disconnected_in_runtime(&runtime_for_connection, result.err());
        });

        if connected_rx.await.is_ok() {
            let _ = mark_agent_runtime_connected_in_runtime(&runtime_state);
        }

        if let Some(device_id) = device_id {
            let snapshot = fetch_provider_models().await;
            let event = crate::protocol::RealtimeEvent::DeviceModelsUpdated {
                event_id: uuid::Uuid::new_v4(),
                timestamp: "1970-01-01T00:00:00.000Z".to_string(),
                user_id: uuid::Uuid::nil(),
                device_id,
                models: snapshot.models,
                default_model: snapshot.default_model,
                error: snapshot.error,
            };
            let _ = server_outbound_tx.send(event).await;
        }

        let result = run_agent_loop(
            &mut manager,
            &mut server_inbound_rx,
            &server_outbound_tx,
            &mut file_change_rx,
            shutdown_rx,
            |event| {
                if let crate::protocol::RealtimeEvent::CodexToolCall {
                    item_id,
                    command,
                    status,
                    output,
                    exit_code,
                    ..
                } = event
                {
                    let _ = remember_agent_command_in_runtime(
                        &runtime_state,
                        AgentCommandLogEntry {
                            item_id: item_id.clone(),
                            command: command.clone(),
                            status: status.clone(),
                            output: output.clone(),
                            exit_code: *exit_code,
                        },
                    );
                }
            },
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
    runtime.connected = false;
    Ok(())
}

fn mark_agent_runtime_connected_in_runtime(runtime_state: &Arc<Mutex<AgentRuntimeState>>) -> Result<(), String> {
    let mut runtime = runtime_state
        .lock()
        .map_err(|_| "agent runtime locked".to_string())?;
    runtime.connected = true;
    runtime.last_error = None;
    Ok(())
}

fn remember_agent_command_in_runtime(
    runtime_state: &Arc<Mutex<AgentRuntimeState>>,
    entry: AgentCommandLogEntry,
) -> Result<(), String> {
    const MAX_RECENT_COMMANDS: usize = 20;

    let mut runtime = runtime_state
        .lock()
        .map_err(|_| "agent runtime locked".to_string())?;
    if let Some(existing_index) = runtime
        .recent_commands
        .iter()
        .position(|current| current.item_id == entry.item_id)
    {
        runtime.recent_commands[existing_index] = entry;
    } else {
        runtime.recent_commands.push(entry);
    }
    if runtime.recent_commands.len() > MAX_RECENT_COMMANDS {
        let overflow = runtime.recent_commands.len() - MAX_RECENT_COMMANDS;
        runtime.recent_commands.drain(0..overflow);
    }
    Ok(())
}

fn mark_agent_runtime_disconnected_in_runtime(
    runtime_state: &Arc<Mutex<AgentRuntimeState>>,
    error: Option<String>,
) -> Result<(), String> {
    let mut runtime = runtime_state
        .lock()
        .map_err(|_| "agent runtime locked".to_string())?;
    runtime.connected = false;
    runtime.last_error = error;
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
        connected: runtime.connected,
        last_error: runtime.last_error.clone(),
        recent_commands: runtime.recent_commands.clone(),
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
    let task = match spawn_agent_runtime_task(state.runtime.clone(), realtime, projects, launch.shutdown_rx) {
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

#[tauri::command]
pub async fn bind_device(
    request: DeviceBindRequestInput,
    state: State<'_, AgentState>,
) -> Result<AgentSettings, String> {
    bind_device_in_state(&state, request).await
}
