use codex_transit_agent::{
    agent_config::{AgentConfig, AgentSettings},
    commands::{get_saved_agent_settings, save_agent_settings_in_state, AgentState},
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
fn reports_unconfigured_before_settings_are_saved() {
    let config = AgentConfig::default();

    assert!(config.get().is_none());
}

#[test]
fn agent_state_owns_projects_and_config() {
    let state = codex_transit_agent::commands::AgentState::default();

    assert!(state.config.lock().unwrap().get().is_none());
    assert!(state.projects.lock().unwrap().list().is_empty());
}

#[test]
fn default_project_registry_remains_empty() {
    let registry = ProjectRegistry::default();

    assert!(registry.list().is_empty());
}

#[test]
fn saves_and_reads_settings_through_agent_state_helpers() {
    let state = AgentState::default();
    let settings = AgentSettings {
        server_url: "https://relay.example.com".to_string(),
        device_id: "00000000-0000-4000-8000-000000000003".to_string(),
        device_token: "secret".to_string(),
    };

    save_agent_settings_in_state(&state, settings.clone()).unwrap();

    assert_eq!(get_saved_agent_settings(&state).unwrap(), Some(settings));
}
