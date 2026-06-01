use codex_transit_agent::codex_adapter::CODEX_THREAD_ID_PREFIX;
use codex_transit_agent::codex_adapter::OutputStream;
use codex_transit_agent::codex_adapter::ProcessOutput;
use codex_transit_agent::protocol::RealtimeEvent;
use codex_transit_agent::session_manager::SessionManager;
use codex_transit_agent::session_manager::{ManagedSessionProcess, SessionProcessRunner};
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Default)]
struct FakeRunner;

struct FakeProcess;

impl ManagedSessionProcess for FakeProcess {
    async fn send_input(&mut self, _text: &str) -> anyhow::Result<()> {
        Ok(())
    }

    async fn stop(&mut self) -> anyhow::Result<()> {
        Ok(())
    }
}

impl SessionProcessRunner for FakeRunner {
    type Process = FakeProcess;

    async fn start_session(
        &self,
        _session_id: Uuid,
        _working_dir: std::path::PathBuf,
        _prompt: String,
        _output_tx: mpsc::Sender<ProcessOutput>,
    ) -> anyhow::Result<Self::Process> {
        Ok(FakeProcess)
    }

    async fn resume_session(
        &self,
        _session_id: Uuid,
        _working_dir: std::path::PathBuf,
        _codex_session_id: String,
        _prompt: String,
        _output_tx: mpsc::Sender<ProcessOutput>,
    ) -> anyhow::Result<Self::Process> {
        Ok(FakeProcess)
    }
}

#[tokio::test]
async fn thread_started_marker_updates_session_binding_without_emitting_chunk() {
    let session_id: Uuid = "00000000-0000-4000-8000-000000000001".parse().unwrap();
    let project_id: Uuid = "00000000-0000-4000-8000-000000000004".parse().unwrap();
    let user_id: Uuid = "00000000-0000-4000-8000-000000000002".parse().unwrap();
    let device_id: Uuid = "00000000-0000-4000-8000-000000000003".parse().unwrap();
    let codex_thread_id = "019e8375-defe-7090-89fa-4144fa4cbdcb";

    let mut manager = SessionManager::new(FakeRunner);
    manager.register_project(project_id, std::path::PathBuf::from("C:/projects/demo"));
    manager
        .handle_event(RealtimeEvent::SessionStart {
            event_id: Uuid::new_v4(),
            timestamp: "2026-06-01T00:00:00.000Z".to_string(),
            user_id,
            device_id,
            project_id,
            session_id,
            codex_session_id: None,
        })
        .await
        .unwrap();

    manager
        .record_process_output(ProcessOutput {
            session_id,
            stream: OutputStream::Stdout,
            text: format!("{CODEX_THREAD_ID_PREFIX}{codex_thread_id}"),
        })
        .await
        .unwrap();

    assert!(manager.try_next_outbound_event().is_none());
}
