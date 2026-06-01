use std::path::PathBuf;

use codex_transit_agent::{
    agent_config::AgentSettings,
    project_registry::ProjectEntry,
    project_sync::{
        build_project_sync_request, sync_projects_from_registry, ProjectSyncHttpClient, SyncProject,
    },
};

#[test]
fn builds_project_sync_request_with_device_token_header() {
    let request = build_project_sync_request(
        "http://localhost:4000",
        "00000000-0000-4000-8000-000000000003",
        "device-token",
        vec![SyncProject {
            agent_key: "local-1".to_string(),
            display_name: "codex-transit".to_string(),
            path_alias: "codex-transit".to_string(),
            available: true,
        }],
    )
    .unwrap();

    assert_eq!(
        request.url.as_str(),
        "http://localhost:4000/agent/projects/sync"
    );
    assert_eq!(request.device_token, "device-token");
    assert!(request
        .body
        .contains("\"deviceId\":\"00000000-0000-4000-8000-000000000003\""));
    assert!(request.body.contains("\"agentKey\":\"local-1\""));
}

#[test]
fn maps_local_projects_to_sync_request_from_saved_settings() {
    let settings = AgentSettings {
        server_url: "https://relay.example.com".to_string(),
        device_id: "00000000-0000-4000-8000-000000000003".to_string(),
        device_token: "device-token".to_string(),
    };
    let projects = vec![ProjectEntry {
        project_id: "00000000-0000-4000-8000-000000000004".parse().unwrap(),
        display_name: "codex-transit".to_string(),
        path_alias: "codex-transit".to_string(),
        root: PathBuf::from("C:/projects/codex-transit"),
        available: true,
    }];

    let request = sync_projects_from_registry(&settings, projects).unwrap();

    assert_eq!(
        request.url.as_str(),
        "https://relay.example.com/agent/projects/sync"
    );
    assert_eq!(request.device_token, "device-token");
    assert!(request
        .body
        .contains("\"agentKey\":\"00000000-0000-4000-8000-000000000004\""));
    assert!(request.body.contains("\"displayName\":\"codex-transit\""));
}

#[test]
fn exposes_request_headers_for_project_sync_http_client() {
    let request = build_project_sync_request(
        "http://localhost:4000",
        "00000000-0000-4000-8000-000000000003",
        "device-token",
        vec![],
    )
    .unwrap();

    assert_eq!(
        ProjectSyncHttpClient::headers(&request),
        vec![
            ("content-type".to_string(), "application/json".to_string()),
            ("x-device-token".to_string(), "device-token".to_string())
        ]
    );
}
