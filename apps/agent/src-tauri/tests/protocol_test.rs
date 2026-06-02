use codex_transit_agent::protocol::RealtimeEvent;

#[test]
fn parses_camel_case_session_input_from_server() {
    let raw = r#"{
      "type":"session.input",
      "eventId":"00000000-0000-4000-8000-000000000001",
      "timestamp":"2026-06-01T00:00:00.000Z",
      "userId":"00000000-0000-4000-8000-000000000002",
      "deviceId":"00000000-0000-4000-8000-000000000003",
      "projectId":"00000000-0000-4000-8000-000000000004",
      "sessionId":"00000000-0000-4000-8000-000000000005",
      "text":"hello",
      "model":"gpt-5.3-codex"
    }"#;

    let event: RealtimeEvent = serde_json::from_str(raw).unwrap();
    assert!(matches!(event, RealtimeEvent::SessionInput { text, model, .. } if text == "hello" && model == Some("gpt-5.3-codex".to_string())));
}

#[test]
fn parses_device_models_updated_event() {
    let raw = r#"{
      "type":"device.models.updated",
      "eventId":"00000000-0000-4000-8000-000000000001",
      "timestamp":"2026-06-02T00:00:00.000Z",
      "userId":"00000000-0000-4000-8000-000000000002",
      "deviceId":"00000000-0000-4000-8000-000000000003",
      "models":[{"id":"gpt-5.3-codex","label":"gpt-5.3-codex","provider":"custom","available":true}],
      "defaultModel":"gpt-5.3-codex"
    }"#;

    let event: RealtimeEvent = serde_json::from_str(raw).unwrap();
    assert!(matches!(event, RealtimeEvent::DeviceModelsUpdated { default_model, models, .. } if default_model == Some("gpt-5.3-codex".to_string()) && models.len() == 1));
}

#[test]
fn serializes_file_change_with_camel_case_fields() {
    let event = RealtimeEvent::FileChanged {
        event_id: "00000000-0000-4000-8000-000000000001".parse().unwrap(),
        timestamp: "2026-06-01T00:00:00.000Z".to_string(),
        user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
        device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
        project_id: "00000000-0000-4000-8000-000000000004".parse().unwrap(),
        session_id: "00000000-0000-4000-8000-000000000005".parse().unwrap(),
        relative_path: "src/main.rs".to_string(),
        old_relative_path: None,
        change_type: "modified".to_string()
    };

    let serialized = serde_json::to_string(&event).unwrap();
    assert!(serialized.contains("eventId"));
    assert!(serialized.contains("relativePath"));
    assert!(serialized.contains("changeType"));
}

#[test]
fn omits_null_optional_fields_from_codex_history_results() {
    let event = RealtimeEvent::CodexHistoryResult {
        event_id: "00000000-0000-4000-8000-000000000001".parse().unwrap(),
        request_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
        timestamp: "2026-06-01T00:00:00.000Z".to_string(),
        user_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
        device_id: "00000000-0000-4000-8000-000000000004".parse().unwrap(),
        ok: true,
        sessions: vec![codex_transit_agent::protocol::CodexHistoryItem {
            codex_session_id: "019e8268-8f45-7422-aff8-5524d4c6990b".to_string(),
            title: "history".to_string(),
            updated_at: "2026-06-01T08:59:41.4407978Z".to_string(),
            preview: None,
        }],
        error: None,
    };

    let serialized = serde_json::to_string(&event).unwrap();

    assert!(!serialized.contains(":null"));
    assert!(!serialized.contains("preview"));
    assert!(!serialized.contains("error"));
}
