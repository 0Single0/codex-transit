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
      "text":"hello"
    }"#;

    let event: RealtimeEvent = serde_json::from_str(raw).unwrap();
    assert!(matches!(event, RealtimeEvent::SessionInput { text, .. } if text == "hello"));
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
