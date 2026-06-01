use std::{collections::HashMap, path::PathBuf};

use anyhow::{bail, Result};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    codex_adapter::{CodexAdapter, CodexSessionProcess, OutputStream, ProcessOutput},
    diff_provider::{GitDiffProvider, ProjectDiffProvider},
    file_watcher::FileChange,
    protocol::RealtimeEvent,
};

pub trait ManagedSessionProcess {
    fn send_input(&mut self, text: &str) -> impl std::future::Future<Output = Result<()>> + Send;
    fn stop(&mut self) -> impl std::future::Future<Output = Result<()>> + Send;
}

pub trait SessionProcessRunner {
    type Process: ManagedSessionProcess + Send;

    fn start_session(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        prompt: String,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> impl std::future::Future<Output = Result<Self::Process>> + Send;
}

pub struct SessionManager<
    R: SessionProcessRunner = CodexAdapter,
    D: ProjectDiffProvider = GitDiffProvider,
> {
    runner: R,
    diff_provider: D,
    projects: HashMap<Uuid, PathBuf>,
    sessions: HashMap<Uuid, R::Process>,
    contexts: HashMap<Uuid, SessionContext>,
    output_seq: HashMap<Uuid, u64>,
    output_tx: mpsc::Sender<ProcessOutput>,
    output_rx: mpsc::Receiver<ProcessOutput>,
    outbound_tx: mpsc::Sender<RealtimeEvent>,
    outbound_rx: mpsc::Receiver<RealtimeEvent>,
}

#[derive(Clone)]
struct SessionContext {
    user_id: Uuid,
    device_id: Uuid,
    project_id: Uuid,
}

impl SessionManager<CodexAdapter, GitDiffProvider> {
    pub fn default_codex() -> Self {
        Self::new(CodexAdapter::new("codex"))
    }
}

impl<R: SessionProcessRunner> SessionManager<R, GitDiffProvider> {
    pub fn new(runner: R) -> Self {
        Self::with_diff_provider(runner, GitDiffProvider)
    }
}

impl<R: SessionProcessRunner, D: ProjectDiffProvider> SessionManager<R, D> {
    pub fn with_diff_provider(runner: R, diff_provider: D) -> Self {
        let (output_tx, output_rx) = mpsc::channel(256);
        let (outbound_tx, outbound_rx) = mpsc::channel(256);
        Self {
            runner,
            diff_provider,
            projects: HashMap::new(),
            sessions: HashMap::new(),
            contexts: HashMap::new(),
            output_seq: HashMap::new(),
            output_tx,
            output_rx,
            outbound_tx,
            outbound_rx,
        }
    }

    pub fn register_project(&mut self, project_id: Uuid, root: PathBuf) {
        self.projects.insert(project_id, root);
    }

    pub async fn handle_event(&mut self, event: RealtimeEvent) -> Result<()> {
        match event {
            RealtimeEvent::SessionStart {
                session_id,
                user_id,
                device_id,
                project_id,
                ..
            } => {
                self.start_session_with_context(
                    session_id,
                    SessionContext {
                        user_id,
                        device_id,
                        project_id,
                    },
                )
                .await
            }
            RealtimeEvent::SessionInput {
                session_id, text, ..
            } => self.send_input(session_id, text).await,
            RealtimeEvent::SessionStop { session_id, .. } => self.stop_session(session_id).await,
            RealtimeEvent::DiffRequest {
                request_id,
                session_id,
                relative_path,
                ..
            } => {
                self.handle_diff_request(request_id, session_id, relative_path)
                    .await
            }
            RealtimeEvent::CodexOutputChunk { .. }
            | RealtimeEvent::FileChanged { .. }
            | RealtimeEvent::DiffResult { .. } => Ok(()),
        }
    }

    pub async fn start_session(&mut self, session_id: Uuid, project_id: Uuid) -> Result<()> {
        self.start_session_with_context(
            session_id,
            SessionContext {
                user_id: Uuid::nil(),
                device_id: Uuid::nil(),
                project_id,
            },
        )
        .await
    }

    async fn start_session_with_context(
        &mut self,
        session_id: Uuid,
        context: SessionContext,
    ) -> Result<()> {
        let Some(project_root) = self.projects.get(&context.project_id).cloned() else {
            bail!("project is not registered");
        };
        self.contexts.insert(session_id, context);
        self.output_seq.insert(session_id, 0);
        let _ = project_root;
        Ok(())
    }

    pub async fn send_input(&mut self, session_id: Uuid, text: String) -> Result<()> {
        let Some(context) = self.contexts.get(&session_id).cloned() else {
            bail!("session is not running");
        };
        let Some(project_root) = self.projects.get(&context.project_id).cloned() else {
            bail!("project is not registered");
        };
        if let Some(process) = self.sessions.get_mut(&session_id) {
            return process.send_input(&text).await;
        }
        let process = self
            .runner
            .start_session(session_id, project_root, text, self.output_tx.clone())
            .await?;
        self.sessions.insert(session_id, process);
        Ok(())
    }

    pub async fn stop_session(&mut self, session_id: Uuid) -> Result<()> {
        self.contexts.remove(&session_id);
        self.output_seq.remove(&session_id);
        let Some(mut process) = self.sessions.remove(&session_id) else {
            return Ok(());
        };
        process.stop().await
    }

    pub async fn record_process_output(&mut self, output: ProcessOutput) -> Result<()> {
        let event = self.output_to_event(output)?;
        self.outbound_tx.send(event).await?;
        Ok(())
    }

    pub async fn next_outbound_event(&mut self) -> Option<RealtimeEvent> {
        self.outbound_rx.recv().await
    }

    pub fn try_next_outbound_event(&mut self) -> Option<RealtimeEvent> {
        self.outbound_rx.try_recv().ok()
    }

    pub async fn pump_process_output_once(&mut self) -> Result<bool> {
        let Some(output) = self.output_rx.recv().await else {
            return Ok(false);
        };
        self.record_process_output(output).await?;
        Ok(true)
    }

    pub async fn next_process_output(&mut self) -> Option<ProcessOutput> {
        self.output_rx.recv().await
    }

    pub fn try_next_process_output(&mut self) -> Option<ProcessOutput> {
        self.output_rx.try_recv().ok()
    }

    pub async fn record_file_change(&mut self, change: FileChange) -> Result<()> {
        let events = self
            .contexts
            .iter()
            .filter(|(_, context)| context.project_id == change.project_id)
            .map(|(session_id, context)| RealtimeEvent::FileChanged {
                event_id: Uuid::new_v4(),
                timestamp: "1970-01-01T00:00:00.000Z".to_string(),
                user_id: context.user_id,
                device_id: context.device_id,
                project_id: context.project_id,
                session_id: *session_id,
                relative_path: change.relative_path.clone(),
                old_relative_path: change.old_relative_path.clone(),
                change_type: change.change_type.clone(),
            })
            .collect::<Vec<_>>();

        for event in events {
            self.outbound_tx.send(event).await?;
        }
        Ok(())
    }

    async fn handle_diff_request(
        &mut self,
        request_id: Uuid,
        session_id: Uuid,
        relative_path: String,
    ) -> Result<()> {
        let Some(context) = self.contexts.get(&session_id).cloned() else {
            bail!("session is not running");
        };
        let Some(project_root) = self.projects.get(&context.project_id) else {
            bail!("project is not registered");
        };
        let diff_result = self.diff_provider.diff_file(project_root, &relative_path);
        let event = match diff_result {
            Ok(diff) => RealtimeEvent::DiffResult {
                event_id: Uuid::new_v4(),
                request_id,
                timestamp: "1970-01-01T00:00:00.000Z".to_string(),
                user_id: context.user_id,
                device_id: context.device_id,
                project_id: context.project_id,
                session_id,
                relative_path,
                ok: true,
                diff: Some(diff),
                error: None,
            },
            Err(error) => RealtimeEvent::DiffResult {
                event_id: Uuid::new_v4(),
                request_id,
                timestamp: "1970-01-01T00:00:00.000Z".to_string(),
                user_id: context.user_id,
                device_id: context.device_id,
                project_id: context.project_id,
                session_id,
                relative_path,
                ok: false,
                diff: None,
                error: Some(error.to_string()),
            },
        };
        self.outbound_tx.send(event).await?;
        Ok(())
    }

    fn output_to_event(&mut self, output: ProcessOutput) -> Result<RealtimeEvent> {
        let Some(context) = self.contexts.get(&output.session_id).cloned() else {
            bail!("session is not running");
        };
        let seq = self.output_seq.entry(output.session_id).or_insert(0);
        let event = RealtimeEvent::CodexOutputChunk {
            event_id: Uuid::new_v4(),
            timestamp: "1970-01-01T00:00:00.000Z".to_string(),
            user_id: context.user_id,
            device_id: context.device_id,
            project_id: context.project_id,
            session_id: output.session_id,
            seq: *seq,
            stream: stream_name(output.stream).to_string(),
            text: output.text,
        };
        *seq += 1;
        Ok(event)
    }
}

impl Default for SessionManager<CodexAdapter, GitDiffProvider> {
    fn default() -> Self {
        Self::default_codex()
    }
}

impl SessionProcessRunner for CodexAdapter {
    type Process = CodexSessionProcess;

    async fn start_session(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        prompt: String,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<Self::Process> {
        self.start(session_id, working_dir, prompt, output_tx).await
    }
}

impl ManagedSessionProcess for CodexSessionProcess {
    async fn send_input(&mut self, text: &str) -> Result<()> {
        CodexSessionProcess::send_input(self, text).await
    }

    async fn stop(&mut self) -> Result<()> {
        CodexSessionProcess::stop(self).await
    }
}

fn stream_name(stream: OutputStream) -> &'static str {
    match stream {
        OutputStream::Stdout => "stdout",
        OutputStream::Stderr => "stderr",
    }
}
