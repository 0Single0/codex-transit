use codex_transit_agent::project_sync::{build_project_sync_request, SyncProject};

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
            available: true
        }]
    )
    .unwrap();

    assert_eq!(request.url.as_str(), "http://localhost:4000/agent/projects/sync");
    assert_eq!(request.device_token, "device-token");
    assert!(request.body.contains("\"deviceId\":\"00000000-0000-4000-8000-000000000003\""));
    assert!(request.body.contains("\"agentKey\":\"local-1\""));
}
