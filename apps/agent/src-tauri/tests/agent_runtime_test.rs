use anyhow::Result;
use codex_transit_agent::{
    agent_runtime::dispatch_event,
    codex_adapter::ProcessOutput,
    protocol::RealtimeEvent,
    session_manager::{ManagedSessionProcess, SessionManager, SessionProcessRunner},
};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Default, Clone)]
struct RuntimeRunner {
    inputs: Arc<Mutex<Vec<String>>>,
}

struct RuntimeProcess {
    inputs: Arc<Mutex<Vec<String>>>,
}

impl SessionProcessRunner for RuntimeRunner {
    type Process = RuntimeProcess;

    async fn start_session(
        &self,
        _session_id: Uuid,
        _working_dir: PathBuf,
        _output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<Self::Process> {
        Ok(RuntimeProcess {
            inputs: self.inputs.clone(),
        })
    }
}

impl ManagedSessionProcess for RuntimeProcess {
    async fn send_input(&mut self, text: &str) -> Result<()> {
        self.inputs.lock().unwrap().push(text.to_string());
        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        Ok(())
    }
}

#[tokio::test]
async fn dispatches_realtime_events_to_session_manager() {
    let runner = RuntimeRunner::default();
    let inputs = runner.inputs.clone();
    let mut manager = SessionManager::new(runner);
    let session_id = "00000000-0000-4000-8000-000000000005".parse().unwrap();
    let project_id = "00000000-0000-4000-8000-000000000004".parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));

    dispatch_event(
        &mut manager,
        RealtimeEvent::SessionStart {
            event_id: "00000000-0000-4000-8000-000000000010".parse().unwrap(),
            timestamp: "2026-06-01T00:00:00.000Z".to_string(),
            user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
            device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
            project_id,
            session_id,
        },
    )
    .await
    .unwrap();

    dispatch_event(
        &mut manager,
        RealtimeEvent::SessionInput {
            event_id: "00000000-0000-4000-8000-000000000011".parse().unwrap(),
            timestamp: "2026-06-01T00:00:01.000Z".to_string(),
            user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
            device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
            project_id,
            session_id,
            text: "hello".to_string(),
        },
    )
    .await
    .unwrap();

    assert_eq!(inputs.lock().unwrap().clone(), vec!["hello".to_string()]);
}
