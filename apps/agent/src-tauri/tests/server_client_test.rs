use codex_transit_agent::{
    agent_config::AgentSettings,
    server_client::{agent_realtime_url, parse_realtime_message, AgentRealtimeConfig},
};

#[test]
fn builds_agent_realtime_url_with_device_token() {
    let url = agent_realtime_url(
        "http://localhost:4000",
        "00000000-0000-4000-8000-000000000003",
        "device token",
    )
    .unwrap();

    assert_eq!(
        url.as_str(),
        "ws://localhost:4000/realtime?role=agent&token=device+token&deviceId=00000000-0000-4000-8000-000000000003"
    );
}

#[test]
fn builds_secure_agent_realtime_url_from_https_base() {
    let url = agent_realtime_url(
        "https://relay.example.com",
        "00000000-0000-4000-8000-000000000003",
        "secret",
    )
    .unwrap();

    assert_eq!(url.scheme(), "wss");
}

#[test]
fn builds_agent_realtime_config_from_saved_settings() {
    let settings = AgentSettings {
        server_url: "https://relay.example.com".to_string(),
        device_id: "00000000-0000-4000-8000-000000000003".to_string(),
        device_token: "secret".to_string(),
    };

    let config = AgentRealtimeConfig::from_settings(&settings).unwrap();

    assert_eq!(
        config.url.as_str(),
        "wss://relay.example.com/realtime?role=agent&token=secret&deviceId=00000000-0000-4000-8000-000000000003"
    );
    assert_eq!(config.device_id, settings.device_id);
}

#[test]
fn ignores_realtime_connected_ack_messages() {
    let event = parse_realtime_message(r#"{"type":"connected","userId":"user-1"}"#).unwrap();

    assert!(event.is_none());
}
