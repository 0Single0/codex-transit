use std::{fs, path::PathBuf};

use codex_transit_agent::{
    agent_config::{AgentConfig, AgentSettings},
    commands::{
        build_project_sync_request_from_state, build_realtime_config_from_state,
        get_agent_runtime_status_from_state, get_saved_agent_settings, mark_agent_runtime_stopped,
        save_agent_settings_in_state, start_agent_runtime_in_state, AgentState,
    },
    project_registry::ProjectRegistry,
};

#[test]
fn stores_and_reads_agent_connection_settings() {
    let mut config = AgentConfig::default();
    let settings = AgentSettings {
        server_url: "http://localhost:4000".to_string(),
        device_id: "00000000-0000-4000-8000-000000000003".to_string(),
        device_token: "device-token".to_string(),
    };

    config.update(settings.clone());

    assert_eq!(config.get(), Some(settings));
}

#[test]
fn saves_and_loads_agent_config_file() {
    let mut config = AgentConfig::default();
    let settings = AgentSettings {
        server_url: "https://relay.example.com".to_string(),
        device_id: "00000000-0000-4000-8000-000000000003".to_string(),
        device_token: "secret".to_string(),
    };
    let file = temp_file("codex-transit-settings.json");

    config.update(settings.clone());
    config.save_to_file(&file).unwrap();
    let loaded = AgentConfig::load_from_file(&file).unwrap();

    fs::remove_file(file).ok();
    assert_eq!(loaded.get(), Some(settings));
}

#[test]
fn missing_agent_config_file_loads_empty() {
    let file = temp_file("missing-codex-transit-settings.json");
    fs::remove_file(&file).ok();

    let loaded = AgentConfig::load_from_file(&file).unwrap();

    assert!(loaded.get().is_none());
}

fn temp_file(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("{}-{}", uuid::Uuid::new_v4(), name))
}

#[test]
fn reports_unconfigured_before_settings_are_saved() {
    let config = AgentConfig::default();

    assert!(config.get().is_none());
}

#[test]
fn agent_state_owns_projects_and_config() {
    let root = temp_file("empty-agent-state");
    let state = codex_transit_agent::commands::AgentState::with_storage(&root);

    fs::remove_dir_all(root).ok();
    assert!(state.config.lock().unwrap().get().is_none());
    assert!(state.projects.lock().unwrap().list().is_empty());
}

#[test]
fn agent_state_loads_saved_config_and_projects_from_storage() {
    let root = temp_file("codex-transit-agent-storage");
    let state = AgentState::with_storage(&root);
    let settings = AgentSettings {
        server_url: "https://relay.example.com".to_string(),
        device_id: "00000000-0000-4000-8000-000000000003".to_string(),
        device_token: "secret".to_string(),
    };

    save_agent_settings_in_state(&state, settings.clone()).unwrap();
    {
        let mut projects = state.projects.lock().unwrap();
        projects.add_project(std::env::temp_dir()).unwrap();
        projects
            .save_to_file(&root.join("projects.json"))
            .unwrap();
    }

    let loaded = AgentState::with_storage(&root);

    fs::remove_dir_all(root).ok();
    assert_eq!(get_saved_agent_settings(&loaded).unwrap(), Some(settings));
    assert_eq!(loaded.projects.lock().unwrap().list().len(), 1);
}

#[test]
fn default_project_registry_remains_empty() {
    let registry = ProjectRegistry::default();

    assert!(registry.list().is_empty());
}

#[test]
fn saves_and_reads_settings_through_agent_state_helpers() {
    let state = AgentState::with_storage(temp_file("settings-through-state"));
    let settings = AgentSettings {
        server_url: "https://relay.example.com".to_string(),
        device_id: "00000000-0000-4000-8000-000000000003".to_string(),
        device_token: "secret".to_string(),
    };

    save_agent_settings_in_state(&state, settings.clone()).unwrap();

    assert_eq!(get_saved_agent_settings(&state).unwrap(), Some(settings));
}

#[test]
fn builds_project_sync_request_from_agent_state() {
    let state = AgentState::with_storage(temp_file("sync-request-state"));
    let settings = AgentSettings {
        server_url: "http://localhost:4000".to_string(),
        device_id: "00000000-0000-4000-8000-000000000003".to_string(),
        device_token: "device-token".to_string(),
    };

    save_agent_settings_in_state(&state, settings).unwrap();
    state
        .projects
        .lock()
        .unwrap()
        .add_project(std::env::temp_dir())
        .unwrap();

    let request = build_project_sync_request_from_state(&state).unwrap();

    assert_eq!(
        request.url.as_str(),
        "http://localhost:4000/agent/projects/sync"
    );
    assert_eq!(request.device_token, "device-token");
    assert!(request.body.contains("\"projects\":["));
}

#[test]
fn rejects_project_sync_request_when_agent_is_unconfigured() {
    let state = AgentState::with_storage(temp_file("unconfigured-sync-state"));

    let err = build_project_sync_request_from_state(&state).unwrap_err();

    assert!(err.contains("agent is not configured"));
}

#[test]
fn builds_realtime_config_from_agent_state() {
    let state = AgentState::with_storage(temp_file("realtime-config-state"));
    save_agent_settings_in_state(
        &state,
        AgentSettings {
            server_url: "http://localhost:4000".to_string(),
            device_id: "00000000-0000-4000-8000-000000000003".to_string(),
            device_token: "device-token".to_string(),
        },
    )
    .unwrap();

    let config = build_realtime_config_from_state(&state).unwrap();

    assert_eq!(config.url.scheme(), "ws");
    assert_eq!(config.device_id, "00000000-0000-4000-8000-000000000003");
}

#[test]
fn rejects_runtime_start_when_agent_is_unconfigured() {
    let state = AgentState::with_storage(temp_file("unconfigured-runtime-state"));

    let err = start_agent_runtime_in_state(&state).unwrap_err();

    assert!(err.contains("agent is not configured"));
}

#[test]
fn marks_runtime_running_and_prevents_duplicate_start() {
    let state = AgentState::with_storage(temp_file("running-runtime-state"));
    save_agent_settings_in_state(
        &state,
        AgentSettings {
            server_url: "http://localhost:4000".to_string(),
            device_id: "00000000-0000-4000-8000-000000000003".to_string(),
            device_token: "device-token".to_string(),
        },
    )
    .unwrap();

    let startup = start_agent_runtime_in_state(&state).unwrap();

    assert_eq!(startup.url.as_str(), "ws://localhost:4000/realtime?role=agent&token=device-token&deviceId=00000000-0000-4000-8000-000000000003");
    assert!(get_agent_runtime_status_from_state(&state).unwrap().running);
    assert!(start_agent_runtime_in_state(&state)
        .unwrap_err()
        .contains("agent runtime is already running"));
}

#[test]
fn marks_runtime_stopped() {
    let state = AgentState::with_storage(temp_file("stopped-runtime-state"));
    save_agent_settings_in_state(
        &state,
        AgentSettings {
            server_url: "http://localhost:4000".to_string(),
            device_id: "00000000-0000-4000-8000-000000000003".to_string(),
            device_token: "device-token".to_string(),
        },
    )
    .unwrap();
    start_agent_runtime_in_state(&state).unwrap();

    mark_agent_runtime_stopped(&state).unwrap();

    assert!(!get_agent_runtime_status_from_state(&state).unwrap().running);
}
