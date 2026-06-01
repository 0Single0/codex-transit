use codex_transit_agent::{
    agent_runtime::dispatch_event,
    protocol::RealtimeEvent,
    session_manager::SessionManager
};

#[test]
fn dispatches_realtime_events_to_session_manager() {
    let mut manager = SessionManager::default();
    let session_id = "00000000-0000-4000-8000-000000000005".parse().unwrap();

    dispatch_event(&mut manager, RealtimeEvent::SessionStart {
        event_id: "00000000-0000-4000-8000-000000000010".parse().unwrap(),
        timestamp: "2026-06-01T00:00:00.000Z".to_string(),
        user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
        device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
        project_id: "00000000-0000-4000-8000-000000000004".parse().unwrap(),
        session_id
    }).unwrap();

    dispatch_event(&mut manager, RealtimeEvent::SessionInput {
        event_id: "00000000-0000-4000-8000-000000000011".parse().unwrap(),
        timestamp: "2026-06-01T00:00:01.000Z".to_string(),
        user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
        device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
        project_id: "00000000-0000-4000-8000-000000000004".parse().unwrap(),
        session_id,
        text: "hello".to_string()
    }).unwrap();

    assert_eq!(manager.recorded_inputs(session_id), vec!["hello".to_string()]);
}
