use std::{collections::HashMap, path::PathBuf};

use anyhow::{bail, Result};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    codex_adapter::{CodexAdapter, CodexSessionProcess, ProcessOutput},
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
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> impl std::future::Future<Output = Result<Self::Process>> + Send;
}

pub struct SessionManager<R: SessionProcessRunner = CodexAdapter> {
    runner: R,
    projects: HashMap<Uuid, PathBuf>,
    sessions: HashMap<Uuid, R::Process>,
    output_tx: mpsc::Sender<ProcessOutput>,
}

impl SessionManager<CodexAdapter> {
    pub fn default_codex() -> Self {
        Self::new(CodexAdapter::new("codex"))
    }
}

impl<R: SessionProcessRunner> SessionManager<R> {
    pub fn new(runner: R) -> Self {
        let (output_tx, _output_rx) = mpsc::channel(256);
        Self {
            runner,
            projects: HashMap::new(),
            sessions: HashMap::new(),
            output_tx,
        }
    }

    pub fn register_project(&mut self, project_id: Uuid, root: PathBuf) {
        self.projects.insert(project_id, root);
    }

    pub async fn handle_event(&mut self, event: RealtimeEvent) -> Result<()> {
        match event {
            RealtimeEvent::SessionStart {
                session_id,
                project_id,
                ..
            } => self.start_session(session_id, project_id).await,
            RealtimeEvent::SessionInput {
                session_id, text, ..
            } => self.send_input(session_id, text).await,
            RealtimeEvent::SessionStop { session_id, .. } => self.stop_session(session_id).await,
            RealtimeEvent::DiffRequest { .. }
            | RealtimeEvent::CodexOutputChunk { .. }
            | RealtimeEvent::FileChanged { .. }
            | RealtimeEvent::DiffResult { .. } => Ok(()),
        }
    }

    pub async fn start_session(&mut self, session_id: Uuid, project_id: Uuid) -> Result<()> {
        let Some(project_root) = self.projects.get(&project_id).cloned() else {
            bail!("project is not registered");
        };
        let process = self
            .runner
            .start_session(session_id, project_root, self.output_tx.clone())
            .await?;
        self.sessions.insert(session_id, process);
        Ok(())
    }

    pub async fn send_input(&mut self, session_id: Uuid, text: String) -> Result<()> {
        let Some(process) = self.sessions.get_mut(&session_id) else {
            bail!("session is not running");
        };
        process.send_input(&text).await
    }

    pub async fn stop_session(&mut self, session_id: Uuid) -> Result<()> {
        let Some(mut process) = self.sessions.remove(&session_id) else {
            return Ok(());
        };
        process.stop().await
    }
}

impl Default for SessionManager<CodexAdapter> {
    fn default() -> Self {
        Self::default_codex()
    }
}

impl SessionProcessRunner for CodexAdapter {
    type Process = CodexSessionProcess;

    async fn start_session(
        &self,
        _session_id: Uuid,
        working_dir: PathBuf,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<Self::Process> {
        self.start(working_dir, output_tx).await
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
