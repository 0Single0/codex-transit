use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use anyhow::Result;
use codex_transit_agent::{
    codex_adapter::ProcessOutput,
    protocol::RealtimeEvent,
    session_manager::{ManagedSessionProcess, SessionManager, SessionProcessRunner},
};
use tokio::sync::mpsc;
use uuid::Uuid;

const SESSION_ID: &str = "00000000-0000-4000-8000-000000000001";
const PROJECT_ID: &str = "00000000-0000-4000-8000-000000000004";

#[derive(Default, Clone)]
struct RunnerState {
    started_dirs: Vec<PathBuf>,
    inputs: HashMap<Uuid, Vec<String>>,
    stopped: Vec<Uuid>,
}

#[derive(Default, Clone)]
struct FakeRunner {
    state: Arc<Mutex<RunnerState>>,
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
        _output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<Self::Process> {
        self.state.lock().unwrap().started_dirs.push(working_dir);
        Ok(FakeProcess {
            session_id,
            state: self.state.clone(),
        })
    }
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
async fn starts_session_for_registered_project_root() {
    let runner = FakeRunner::default();
    let state = runner.state.clone();
    let mut manager = SessionManager::new(runner);
    let session_id = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();
    let project_root = PathBuf::from("C:/projects/demo");

    manager.register_project(project_id, project_root.clone());
    manager.start_session(session_id, project_id).await.unwrap();

    assert_eq!(state.lock().unwrap().started_dirs, vec![project_root]);
}

#[tokio::test]
async fn forwards_input_to_started_session() {
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

    assert_eq!(
        state
            .lock()
            .unwrap()
            .inputs
            .get(&session_id)
            .cloned()
            .unwrap(),
        vec!["hello".to_string()]
    );
}

#[tokio::test]
async fn handles_start_and_input_events() {
    let runner = FakeRunner::default();
    let state = runner.state.clone();
    let mut manager = SessionManager::new(runner);
    let session_id = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));

    manager
        .handle_event(RealtimeEvent::SessionStart {
            event_id: "00000000-0000-4000-8000-000000000010".parse().unwrap(),
            timestamp: "2026-06-01T00:00:00.000Z".to_string(),
            user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
            device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
            project_id,
            session_id,
        })
        .await
        .unwrap();

    manager
        .handle_event(RealtimeEvent::SessionInput {
            event_id: "00000000-0000-4000-8000-000000000011".parse().unwrap(),
            timestamp: "2026-06-01T00:00:01.000Z".to_string(),
            user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
            device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
            project_id,
            session_id,
            text: "implement it".to_string(),
        })
        .await
        .unwrap();

    assert_eq!(
        state
            .lock()
            .unwrap()
            .inputs
            .get(&session_id)
            .cloned()
            .unwrap(),
        vec!["implement it".to_string()]
    );
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
