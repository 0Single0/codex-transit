use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use anyhow::Result;
use codex_transit_agent::{
    codex_adapter::{OutputStream, ProcessOutput},
    diff_provider::ProjectDiffProvider,
    file_watcher::FileChange,
    protocol::RealtimeEvent,
    session_manager::{ManagedSessionProcess, SessionManager, SessionProcessRunner},
};
use tokio::sync::mpsc;
use uuid::Uuid;

const SESSION_ID: &str = "00000000-0000-4000-8000-000000000001";
const USER_ID: &str = "00000000-0000-4000-8000-000000000002";
const DEVICE_ID: &str = "00000000-0000-4000-8000-000000000003";
const PROJECT_ID: &str = "00000000-0000-4000-8000-000000000004";

#[derive(Default, Clone)]
struct RunnerState {
    started_dirs: Vec<PathBuf>,
    started_prompts: Vec<String>,
    inputs: HashMap<Uuid, Vec<String>>,
    stopped: Vec<Uuid>,
}

#[derive(Default, Clone)]
struct FakeRunner {
    state: Arc<Mutex<RunnerState>>,
}

#[derive(Clone)]
struct FakeDiffProvider {
    result: Result<String, String>,
}

struct FakeProcess {
    session_id: Uuid,
    state: Arc<Mutex<RunnerState>>,
}

impl SessionProcessRunner for FakeRunner {
    type Process = FakeProcess;

    async fn start_session(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        prompt: String,
        _output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<Self::Process> {
        let mut state = self.state.lock().unwrap();
        state.started_dirs.push(working_dir);
        state.started_prompts.push(prompt);
        drop(state);
        Ok(FakeProcess {
            session_id,
            state: self.state.clone(),
        })
    }
}

impl Default for FakeDiffProvider {
    fn default() -> Self {
        Self {
            result: Ok("diff --git a/src/main.rs b/src/main.rs".to_string()),
        }
    }
}

impl ProjectDiffProvider for FakeDiffProvider {
    fn diff_file(&self, _project_root: &std::path::Path, _relative_path: &str) -> Result<String> {
        match &self.result {
            Ok(diff) => Ok(diff.clone()),
            Err(error) => anyhow::bail!(error.clone()),
        }
    }
}

fn start_event() -> RealtimeEvent {
    RealtimeEvent::SessionStart {
        event_id: "00000000-0000-4000-8000-000000000010".parse().unwrap(),
        timestamp: "2026-06-01T00:00:00.000Z".to_string(),
        user_id: USER_ID.parse().unwrap(),
        device_id: DEVICE_ID.parse().unwrap(),
        project_id: PROJECT_ID.parse().unwrap(),
        session_id: SESSION_ID.parse().unwrap(),
    }
}

fn manager_with_diff_provider(
    diff_provider: FakeDiffProvider,
) -> SessionManager<FakeRunner, FakeDiffProvider> {
    SessionManager::with_diff_provider(FakeRunner::default(), diff_provider)
}

impl ManagedSessionProcess for FakeProcess {
    async fn send_input(&mut self, text: &str) -> Result<()> {
        self.state
            .lock()
            .unwrap()
            .inputs
            .entry(self.session_id)
            .or_default()
            .push(text.to_string());
        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        self.state.lock().unwrap().stopped.push(self.session_id);
        Ok(())
    }
}

#[tokio::test]
async fn rejects_input_for_missing_session() {
    let mut manager = SessionManager::new(FakeRunner::default());
    let err = manager
        .send_input(SESSION_ID.parse().unwrap(), "hello".to_string())
        .await
        .unwrap_err();

    assert!(err.to_string().contains("session is not running"));
}

#[tokio::test]
async fn session_start_registers_context_without_spawning_codex() {
    let runner = FakeRunner::default();
    let state = runner.state.clone();
    let mut manager = SessionManager::new(runner);
    let session_id: Uuid = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();
    let project_root = PathBuf::from("C:/projects/demo");

    manager.register_project(project_id, project_root.clone());
    manager.start_session(session_id, project_id).await.unwrap();

    assert!(state.lock().unwrap().started_dirs.is_empty());
}

#[tokio::test]
async fn starts_codex_with_first_input_prompt() {
    let runner = FakeRunner::default();
    let state = runner.state.clone();
    let mut manager = SessionManager::new(runner);
    let session_id = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    manager.start_session(session_id, project_id).await.unwrap();
    manager
        .send_input(session_id, "hello".to_string())
        .await
        .unwrap();

    let state = state.lock().unwrap();
    assert_eq!(state.started_dirs, vec![PathBuf::from("C:/projects/demo")]);
    assert_eq!(state.started_prompts, vec!["hello".to_string()]);
}

#[tokio::test]
async fn handles_start_and_input_events() {
    let runner = FakeRunner::default();
    let state = runner.state.clone();
    let mut manager = SessionManager::new(runner);
    let session_id = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));

    manager.handle_event(start_event()).await.unwrap();

    manager
        .handle_event(RealtimeEvent::SessionInput {
            event_id: "00000000-0000-4000-8000-000000000011".parse().unwrap(),
            timestamp: "2026-06-01T00:00:01.000Z".to_string(),
            user_id: USER_ID.parse().unwrap(),
            device_id: DEVICE_ID.parse().unwrap(),
            project_id,
            session_id,
            text: "implement it".to_string(),
        })
        .await
        .unwrap();

    assert_eq!(
        state.lock().unwrap().started_prompts,
        vec!["implement it".to_string()]
    );
}

#[tokio::test]
async fn converts_codex_process_output_to_realtime_chunk() {
    let mut manager = SessionManager::new(FakeRunner::default());
    let session_id = SESSION_ID.parse().unwrap();
    let expected_user_id: Uuid = USER_ID.parse().unwrap();
    let expected_device_id: Uuid = DEVICE_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    manager.handle_event(start_event()).await.unwrap();
    manager
        .record_process_output(ProcessOutput {
            session_id,
            stream: OutputStream::Stdout,
            text: "hello from codex".to_string(),
        })
        .await
        .unwrap();

    let event = manager.next_outbound_event().await.unwrap();

    assert!(matches!(
        event,
        RealtimeEvent::CodexOutputChunk {
            user_id,
            device_id,
            project_id: chunk_project_id,
            session_id: chunk_session_id,
            seq: 0,
            stream,
            text,
            ..
        } if user_id == expected_user_id
            && device_id == expected_device_id
            && chunk_project_id == project_id
            && chunk_session_id == session_id
            && stream == "stdout"
            && text == "hello from codex"
    ));
}

#[tokio::test]
async fn increments_output_sequence_per_session() {
    let mut manager = SessionManager::new(FakeRunner::default());
    let session_id = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    manager.handle_event(start_event()).await.unwrap();
    manager
        .record_process_output(ProcessOutput {
            session_id,
            stream: OutputStream::Stdout,
            text: "first".to_string(),
        })
        .await
        .unwrap();
    manager
        .record_process_output(ProcessOutput {
            session_id,
            stream: OutputStream::Stderr,
            text: "second".to_string(),
        })
        .await
        .unwrap();

    let first = manager.next_outbound_event().await.unwrap();
    let second = manager.next_outbound_event().await.unwrap();

    assert!(matches!(
        first,
        RealtimeEvent::CodexOutputChunk { seq: 0, .. }
    ));
    assert!(matches!(
        second,
        RealtimeEvent::CodexOutputChunk {
            seq: 1,
            stream,
            ..
        } if stream == "stderr"
    ));
}

#[tokio::test]
async fn stop_event_stops_and_removes_running_session() {
    let runner = FakeRunner::default();
    let state = runner.state.clone();
    let mut manager = SessionManager::new(runner);
    let session_id = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    manager.start_session(session_id, project_id).await.unwrap();
    manager
        .send_input(session_id, "run before stop".to_string())
        .await
        .unwrap();
    manager
        .handle_event(RealtimeEvent::SessionStop {
            event_id: "00000000-0000-4000-8000-000000000012".parse().unwrap(),
            timestamp: "2026-06-01T00:00:02.000Z".to_string(),
            user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
            device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
            project_id,
            session_id,
        })
        .await
        .unwrap();

    assert_eq!(state.lock().unwrap().stopped, vec![session_id]);

    let err = manager
        .send_input(session_id, "after stop".to_string())
        .await
        .unwrap_err();
    assert!(err.to_string().contains("session is not running"));
}

#[tokio::test]
async fn handles_diff_request_with_diff_result_event() {
    let mut manager = manager_with_diff_provider(FakeDiffProvider::default());
    let session_id = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();
    let request_id = "00000000-0000-4000-8000-000000000020".parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    manager.handle_event(start_event()).await.unwrap();
    manager
        .handle_event(RealtimeEvent::DiffRequest {
            event_id: "00000000-0000-4000-8000-000000000021".parse().unwrap(),
            request_id,
            timestamp: "2026-06-01T00:00:03.000Z".to_string(),
            user_id: USER_ID.parse().unwrap(),
            device_id: DEVICE_ID.parse().unwrap(),
            project_id,
            session_id,
            relative_path: "src/main.rs".to_string(),
        })
        .await
        .unwrap();

    let event = manager.next_outbound_event().await.unwrap();

    assert!(matches!(
        event,
        RealtimeEvent::DiffResult {
            request_id: result_request_id,
            project_id: result_project_id,
            session_id: result_session_id,
            relative_path,
            ok: true,
            diff: Some(diff),
            error: None,
            ..
        } if result_request_id == request_id
            && result_project_id == project_id
            && result_session_id == session_id
            && relative_path == "src/main.rs"
            && diff.contains("diff --git")
    ));
}

#[tokio::test]
async fn handles_diff_provider_errors_with_failed_diff_result() {
    let mut manager = manager_with_diff_provider(FakeDiffProvider {
        result: Err("path resolves outside project".to_string()),
    });
    let session_id = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();
    let request_id = "00000000-0000-4000-8000-000000000020".parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    manager.handle_event(start_event()).await.unwrap();
    manager
        .handle_event(RealtimeEvent::DiffRequest {
            event_id: "00000000-0000-4000-8000-000000000021".parse().unwrap(),
            request_id,
            timestamp: "2026-06-01T00:00:03.000Z".to_string(),
            user_id: USER_ID.parse().unwrap(),
            device_id: DEVICE_ID.parse().unwrap(),
            project_id,
            session_id,
            relative_path: "../secret.txt".to_string(),
        })
        .await
        .unwrap();

    let event = manager.next_outbound_event().await.unwrap();

    assert!(matches!(
        event,
        RealtimeEvent::DiffResult {
            ok: false,
            diff: None,
            error: Some(error),
            ..
        } if error.contains("outside project")
    ));
}

#[tokio::test]
async fn records_file_change_as_outbound_event_for_running_session() {
    let mut manager = SessionManager::new(FakeRunner::default());
    let session_id: Uuid = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    manager.handle_event(start_event()).await.unwrap();
    manager
        .record_file_change(FileChange {
            project_id,
            relative_path: "src/main.rs".to_string(),
            old_relative_path: None,
            change_type: "modified".to_string(),
        })
        .await
        .unwrap();

    let event = manager.next_outbound_event().await.unwrap();

    assert!(matches!(
        event,
        RealtimeEvent::FileChanged {
            user_id,
            device_id,
            project_id: event_project_id,
            session_id: event_session_id,
            relative_path,
            old_relative_path: None,
            change_type,
            ..
        } if user_id == USER_ID.parse::<Uuid>().unwrap()
            && device_id == DEVICE_ID.parse::<Uuid>().unwrap()
            && event_project_id == project_id
            && event_session_id == session_id
            && relative_path == "src/main.rs"
            && change_type == "modified"
    ));
}
