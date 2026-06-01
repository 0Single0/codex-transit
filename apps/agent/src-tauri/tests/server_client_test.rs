use codex_transit_agent::server_client::agent_realtime_url;

#[test]
fn builds_agent_realtime_url_with_device_token() {
    let url = agent_realtime_url(
        "http://localhost:4000",
        "00000000-0000-4000-8000-000000000003",
        "device token"
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
        "secret"
    )
    .unwrap();

    assert_eq!(url.scheme(), "wss");
}
