use std::{fs, path::PathBuf};

use codex_transit_agent::codex_history::{
    list_codex_history_from_home, load_codex_history_messages_from_home, CodexHistoryListOptions,
};

#[test]
fn lists_codex_history_from_session_index_newest_first() {
    let root = unique_temp_dir();
    fs::create_dir_all(&root).unwrap();
    fs::write(
        root.join("session_index.jsonl"),
        [
            r#"{"id":"old","thread_name":"旧会话","updated_at":"2026-06-01T08:00:00.000Z"}"#,
            r#"{"id":"new","thread_name":"新会话","updated_at":"2026-06-01T09:00:00.000Z"}"#,
        ]
        .join("\n"),
    )
    .unwrap();

    let sessions = list_codex_history_from_home(
        &root,
        CodexHistoryListOptions {
            limit: 1,
            project_root: None,
        },
    )
    .unwrap();

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].codex_session_id, "new");
    assert_eq!(sessions[0].title, "新会话");
}

#[test]
fn filters_codex_history_by_project_root_from_session_meta() {
    let root = unique_temp_dir();
    fs::create_dir_all(root.join("sessions/2026/06/01")).unwrap();
    fs::write(
        root.join("session_index.jsonl"),
        [
            r#"{"id":"project-match","thread_name":"Match","updated_at":"2026-06-01T09:00:00.000Z"}"#,
            r#"{"id":"other-project","thread_name":"Other","updated_at":"2026-06-01T10:00:00.000Z"}"#,
        ].join("\n"),
    ).unwrap();
    fs::write(
        root.join("sessions/2026/06/01/rollout-project-match.jsonl"),
        r#"{"timestamp":"2026-06-01T09:00:00.000Z","type":"session_meta","payload":{"id":"project-match","cwd":"C:\\work\\current"}}"#,
    ).unwrap();
    fs::write(
        root.join("sessions/2026/06/01/rollout-other-project.jsonl"),
        r#"{"timestamp":"2026-06-01T10:00:00.000Z","type":"session_meta","payload":{"id":"other-project","cwd":"C:\\work\\other"}}"#,
    ).unwrap();

    let sessions = list_codex_history_from_home(
        &root,
        CodexHistoryListOptions {
            limit: 10,
            project_root: Some(PathBuf::from("C:/work/current")),
        },
    )
    .unwrap();

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].codex_session_id, "project-match");
}

#[test]
fn matches_codex_history_when_project_root_uses_windows_verbatim_prefix() {
    let root = unique_temp_dir();
    fs::create_dir_all(root.join("sessions/2026/06/01")).unwrap();
    fs::write(
        root.join("session_index.jsonl"),
        r#"{"id":"project-match","thread_name":"Match","updated_at":"2026-06-01T09:00:00.000Z"}"#,
    )
    .unwrap();
    fs::write(
        root.join("sessions/2026/06/01/rollout-project-match.jsonl"),
        r#"{"timestamp":"2026-06-01T09:00:00.000Z","type":"session_meta","payload":{"id":"project-match","cwd":"E:\\code\\codex-transit"}}"#,
    )
    .unwrap();

    let sessions = list_codex_history_from_home(
        &root,
        CodexHistoryListOptions {
            limit: 10,
            project_root: Some(PathBuf::from(r"\\?\E:\code\codex-transit")),
        },
    )
    .unwrap();

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].codex_session_id, "project-match");
}

#[test]
fn filters_codex_history_without_scanning_for_each_index_row() {
    let root = unique_temp_dir();
    let session_dir = root.join("sessions/2026/06/01");
    fs::create_dir_all(&session_dir).unwrap();
    let mut index_lines = Vec::new();
    for i in 0..120 {
        let id = format!("session-{i}");
        index_lines.push(format!(
            r#"{{"id":"{id}","thread_name":"Session {i}","updated_at":"2026-06-01T09:{:02}:00.000Z"}}"#,
            i % 60
        ));
        let cwd = if i % 30 == 0 {
            "C:\\work\\current"
        } else {
            "C:\\work\\other"
        };
        let escaped_cwd = cwd.replace('\\', "\\\\");
        fs::write(
            session_dir.join(format!("rollout-{id}.jsonl")),
            format!(
                r#"{{"timestamp":"2026-06-01T09:00:00.000Z","type":"session_meta","payload":{{"id":"{id}","cwd":"{escaped_cwd}"}}}}"#
            ),
        )
        .unwrap();
    }
    fs::write(root.join("session_index.jsonl"), index_lines.join("\n")).unwrap();

    let started = std::time::Instant::now();
    let sessions = list_codex_history_from_home(
        &root,
        CodexHistoryListOptions {
            limit: 10,
            project_root: Some(PathBuf::from("C:/work/current")),
        },
    )
    .unwrap();

    assert_eq!(sessions.len(), 4);
    assert!(started.elapsed() < std::time::Duration::from_millis(300));
}

#[test]
fn loads_codex_history_messages_from_session_rollout_file() {
    let root = unique_temp_dir();
    let session_dir = root.join("sessions/2026/06/01");
    fs::create_dir_all(&session_dir).unwrap();
    fs::write(
        session_dir.join("rollout-2026-06-01T16-59-16-session-1.jsonl"),
        [
            r#"{"timestamp":"2026-06-01T08:59:36.000Z","type":"event_msg","payload":{"type":"user_message","message":"你好"}}"#,
            r#"{"timestamp":"2026-06-01T08:59:44.000Z","type":"event_msg","payload":{"type":"agent_message","message":"已收到"}}"#,
        ].join("\n"),
    ).unwrap();

    let messages = load_codex_history_messages_from_home(&root, "session-1").unwrap();

    assert_eq!(messages.len(), 2);
    assert_eq!(messages[0].role, "user");
    assert_eq!(messages[0].text, "你好");
    assert_eq!(messages[1].role, "assistant");
}

fn unique_temp_dir() -> PathBuf {
    std::env::temp_dir().join(format!(
        "codex-history-test-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}
