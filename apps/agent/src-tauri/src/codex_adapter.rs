use std::path::PathBuf;

use anyhow::Result;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, Command},
    sync::mpsc,
};
use uuid::Uuid;

#[derive(Debug)]
pub struct ProcessOutput {
    pub session_id: Uuid,
    pub stream: OutputStream,
    pub text: String,
}

#[derive(Debug)]
pub enum OutputStream {
    Stdout,
    Stderr,
}

pub struct CodexSessionProcess {
    child: Child,
    stdin: ChildStdin,
}

pub struct CodexAdapter {
    command: String,
}

#[derive(Clone, Debug, Default)]
pub struct CodexExecOptions {
    pub sandbox: Option<String>,
    pub model: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CodexExecCommand {
    pub program: String,
    pub args: Vec<String>,
}

impl CodexAdapter {
    pub fn new(command: impl Into<String>) -> Self {
        Self {
            command: command.into(),
        }
    }

    pub fn build_exec_command(
        &self,
        working_dir: PathBuf,
        options: CodexExecOptions,
    ) -> CodexExecCommand {
        let mut args = vec![
            "exec".to_string(),
            "--cd".to_string(),
            working_dir.to_string_lossy().replace('\\', "/"),
        ];
        if let Some(sandbox) = options.sandbox {
            args.push("--sandbox".to_string());
            args.push(sandbox);
        }
        if let Some(model) = options.model {
            args.push("--model".to_string());
            args.push(model);
        }
        args.push("-".to_string());
        CodexExecCommand {
            program: self.command.clone(),
            args,
        }
    }

    pub async fn start(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        prompt: String,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        let exec = self.build_exec_command(working_dir.clone(), CodexExecOptions::default());
        let mut child = Command::new(exec.program)
            .args(exec.args)
            .current_dir(working_dir)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        let mut stdin = child.stdin.take().expect("child stdin should be piped");
        stdin.write_all(prompt.as_bytes()).await?;
        stdin.write_all(b"\n").await?;
        stdin.shutdown().await?;
        if let Some(stdout) = child.stdout.take() {
            let tx = output_tx.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = tx
                        .send(ProcessOutput {
                            session_id,
                            stream: OutputStream::Stdout,
                            text: line,
                        })
                        .await;
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let tx = output_tx;
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = tx
                        .send(ProcessOutput {
                            session_id,
                            stream: OutputStream::Stderr,
                            text: line,
                        })
                        .await;
                }
            });
        }

        Ok(CodexSessionProcess { child, stdin })
    }
}

impl CodexSessionProcess {
    pub async fn send_input(&mut self, text: &str) -> Result<()> {
        self.stdin.write_all(text.as_bytes()).await?;
        self.stdin.write_all(b"\n").await?;
        self.stdin.flush().await?;
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<()> {
        self.child.kill().await?;
        Ok(())
    }
}
