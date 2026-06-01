use codex_transit_agent::session_manager::SessionManager;
use codex_transit_agent::protocol::RealtimeEvent;

const SESSION_ID: &str = "00000000-0000-4000-8000-000000000001";

#[test]
fn rejects_input_for_missing_session() {
    let mut manager = SessionManager::default();
    let err = manager
        .send_input(SESSION_ID.parse().unwrap(), "hello".to_string())
        .unwrap_err();

    assert!(err.to_string().contains("session is not running"));
}

#[test]
fn records_input_for_started_session() {
    let mut manager = SessionManager::default();
    let session_id = SESSION_ID.parse().unwrap();

    manager.start_recording_session(session_id);
    manager.send_input(session_id, "hello".to_string()).unwrap();

    assert_eq!(manager.recorded_inputs(session_id), vec!["hello".to_string()]);
}

#[test]
fn handles_start_and_input_events() {
    let mut manager = SessionManager::default();
    let session_id = SESSION_ID.parse().unwrap();

    manager.handle_event(RealtimeEvent::SessionStart {
        event_id: "00000000-0000-4000-8000-000000000010".parse().unwrap(),
        timestamp: "2026-06-01T00:00:00.000Z".to_string(),
        user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
        device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
        project_id: "00000000-0000-4000-8000-000000000004".parse().unwrap(),
        session_id
    }).unwrap();

    manager.handle_event(RealtimeEvent::SessionInput {
        event_id: "00000000-0000-4000-8000-000000000011".parse().unwrap(),
        timestamp: "2026-06-01T00:00:01.000Z".to_string(),
        user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
        device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
        project_id: "00000000-0000-4000-8000-000000000004".parse().unwrap(),
        session_id,
        text: "implement it".to_string()
    }).unwrap();

    assert_eq!(manager.recorded_inputs(session_id), vec!["implement it".to_string()]);
}

#[test]
fn stop_event_removes_running_session() {
    let mut manager = SessionManager::default();
    let session_id = SESSION_ID.parse().unwrap();

    manager.start_recording_session(session_id);
    manager.handle_event(RealtimeEvent::SessionStop {
        event_id: "00000000-0000-4000-8000-000000000012".parse().unwrap(),
        timestamp: "2026-06-01T00:00:02.000Z".to_string(),
        user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
        device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
        project_id: "00000000-0000-4000-8000-000000000004".parse().unwrap(),
        session_id
    }).unwrap();

    let err = manager.send_input(session_id, "after stop".to_string()).unwrap_err();
    assert!(err.to_string().contains("session is not running"));
}
