use std::path::PathBuf;

use anyhow::Result;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, Command},
    sync::mpsc
};

#[derive(Debug)]
pub struct ProcessOutput {
    pub stream: OutputStream,
    pub text: String
}

#[derive(Debug)]
pub enum OutputStream {
    Stdout,
    Stderr
}

pub struct CodexSessionProcess {
    child: Child,
    stdin: ChildStdin
}

pub struct CodexAdapter {
    command: String
}

impl CodexAdapter {
    pub fn new(command: impl Into<String>) -> Self {
        Self { command: command.into() }
    }

    pub async fn start(
        &self,
        working_dir: PathBuf,
        output_tx: mpsc::Sender<ProcessOutput>
    ) -> Result<CodexSessionProcess> {
        let mut child = Command::new(&self.command)
            .current_dir(working_dir)
            .arg("--help")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        let stdin = child.stdin.take().expect("child stdin should be piped");
        if let Some(stdout) = child.stdout.take() {
            let tx = output_tx.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = tx
                        .send(ProcessOutput {
                            stream: OutputStream::Stdout,
                            text: line
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
                            stream: OutputStream::Stderr,
                            text: line
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
