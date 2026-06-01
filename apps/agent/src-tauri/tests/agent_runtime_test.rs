use anyhow::Result;
use codex_transit_agent::{
    agent_runtime::{
        dispatch_event, forward_next_outbound_event, handle_next_inbound_event,
        pump_next_file_change, pump_next_process_output,
    },
    codex_adapter::{OutputStream, ProcessOutput},
    protocol::RealtimeEvent,
    session_manager::{ManagedSessionProcess, SessionManager, SessionProcessRunner},
};
use notify::{event::ModifyKind, Event, EventKind};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Default, Clone)]
struct RuntimeRunner {
    inputs: Arc<Mutex<Vec<String>>>,
    output_txs: Arc<Mutex<Vec<mpsc::Sender<ProcessOutput>>>>,
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
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<Self::Process> {
        self.output_txs.lock().unwrap().push(output_tx);
        Ok(RuntimeProcess {
            inputs: self.inputs.clone(),
        })
    }
}

#[tokio::test]
async fn pumps_process_output_into_outbound_events() {
    let runner = RuntimeRunner::default();
    let output_txs = runner.output_txs.clone();
    let mut manager = SessionManager::new(runner);
    let session_id = "00000000-0000-4000-8000-000000000005".parse().unwrap();
    let project_id = "00000000-0000-4000-8000-000000000004".parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    manager
        .handle_event(session_start_event(project_id, session_id))
        .await
        .unwrap();
    let output_tx = output_txs.lock().unwrap().first().unwrap().clone();
    output_tx
        .send(ProcessOutput {
            session_id,
            stream: OutputStream::Stdout,
            text: "from child".to_string(),
        })
        .await
        .unwrap();

    assert!(pump_next_process_output(&mut manager).await.unwrap());

    let event = manager.next_outbound_event().await.unwrap();
    assert!(matches!(
        event,
        RealtimeEvent::CodexOutputChunk { text, .. } if text == "from child"
    ));
}

#[tokio::test]
async fn pumps_file_watcher_event_into_outbound_events() {
    let mut manager = SessionManager::new(RuntimeRunner::default());
    let (watch_tx, watch_rx) = mpsc::channel(8);
    let session_id = "00000000-0000-4000-8000-000000000005".parse().unwrap();
    let project_id = "00000000-0000-4000-8000-000000000004".parse().unwrap();
    let project_root = PathBuf::from("C:/projects/demo");

    manager.register_project(project_id, project_root.clone());
    manager
        .handle_event(session_start_event(project_id, session_id))
        .await
        .unwrap();
    watch_tx
        .send(
            Event::new(EventKind::Modify(ModifyKind::Any))
                .add_path(PathBuf::from("C:/projects/demo/src/main.rs")),
        )
        .await
        .unwrap();

    let mut watch_rx = watch_rx;
    assert!(
        pump_next_file_change(&mut manager, &mut watch_rx, project_id, &project_root)
            .await
            .unwrap()
    );

    let event = manager.next_outbound_event().await.unwrap();
    assert!(matches!(
        event,
        RealtimeEvent::FileChanged {
            relative_path,
            change_type,
            ..
        } if relative_path == "src/main.rs" && change_type == "modified"
    ));
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

fn session_start_event(project_id: Uuid, session_id: Uuid) -> RealtimeEvent {
    RealtimeEvent::SessionStart {
        event_id: "00000000-0000-4000-8000-000000000010".parse().unwrap(),
        timestamp: "2026-06-01T00:00:00.000Z".to_string(),
        user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
        device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
        project_id,
        session_id,
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

    dispatch_event(&mut manager, session_start_event(project_id, session_id))
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

#[tokio::test]
async fn handles_next_inbound_event_from_realtime_channel() {
    let runner = RuntimeRunner::default();
    let inputs = runner.inputs.clone();
    let mut manager = SessionManager::new(runner);
    let (inbound_tx, inbound_rx) = mpsc::channel(8);
    let session_id = "00000000-0000-4000-8000-000000000005".parse().unwrap();
    let project_id = "00000000-0000-4000-8000-000000000004".parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    inbound_tx
        .send(session_start_event(project_id, session_id))
        .await
        .unwrap();
    inbound_tx
        .send(RealtimeEvent::SessionInput {
            event_id: "00000000-0000-4000-8000-000000000011".parse().unwrap(),
            timestamp: "2026-06-01T00:00:01.000Z".to_string(),
            user_id: "00000000-0000-4000-8000-000000000002".parse().unwrap(),
            device_id: "00000000-0000-4000-8000-000000000003".parse().unwrap(),
            project_id,
            session_id,
            text: "from channel".to_string(),
        })
        .await
        .unwrap();

    let mut inbound_rx = inbound_rx;
    assert!(handle_next_inbound_event(&mut manager, &mut inbound_rx)
        .await
        .unwrap());
    assert!(handle_next_inbound_event(&mut manager, &mut inbound_rx)
        .await
        .unwrap());

    assert_eq!(
        inputs.lock().unwrap().clone(),
        vec!["from channel".to_string()]
    );
}

#[tokio::test]
async fn forwards_next_outbound_event_to_realtime_channel() {
    let mut manager = SessionManager::new(RuntimeRunner::default());
    let (outbound_tx, mut outbound_rx) = mpsc::channel(8);
    let session_id = "00000000-0000-4000-8000-000000000005".parse().unwrap();
    let project_id = "00000000-0000-4000-8000-000000000004".parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    manager
        .handle_event(session_start_event(project_id, session_id))
        .await
        .unwrap();
    manager
        .record_process_output(ProcessOutput {
            session_id,
            stream: OutputStream::Stdout,
            text: "streamed".to_string(),
        })
        .await
        .unwrap();

    assert!(forward_next_outbound_event(&mut manager, &outbound_tx)
        .await
        .unwrap());

    let event = outbound_rx.recv().await.unwrap();
    assert!(matches!(
        event,
        RealtimeEvent::CodexOutputChunk { text, .. } if text == "streamed"
    ));
}
