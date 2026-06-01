use std::{env, path::PathBuf};

use anyhow::{Context, Result};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, Command},
    sync::mpsc,
};
use uuid::Uuid;

use crate::path_utils::normalize_for_windows_process_path;

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

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProcessInvocation {
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
        let normalized_working_dir = normalize_for_windows_process_path(&working_dir);
        let mut args = vec![
            "exec".to_string(),
            "--cd".to_string(),
            normalized_working_dir.to_string_lossy().replace('\\', "/"),
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

    pub fn build_resume_command(
        &self,
        _working_dir: PathBuf,
        codex_session_id: &str,
        _options: CodexExecOptions,
    ) -> CodexExecCommand {
        CodexExecCommand {
            program: self.command.clone(),
            args: vec![
                "exec".to_string(),
                "resume".to_string(),
                "--skip-git-repo-check".to_string(),
                codex_session_id.to_string(),
                "-".to_string(),
            ],
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
        self.spawn_command(session_id, working_dir, exec, prompt, output_tx)
            .await
    }

    pub async fn resume(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        codex_session_id: String,
        prompt: String,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        let exec = self.build_resume_command(
            working_dir.clone(),
            &codex_session_id,
            CodexExecOptions::default(),
        );
        self.spawn_command(session_id, working_dir, exec, prompt, output_tx)
            .await
    }

    async fn spawn_command(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        exec: CodexExecCommand,
        prompt: String,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        let working_dir = normalize_for_windows_process_path(&working_dir);
        let invocation = prepare_command_invocation(PathBuf::from(exec.program), exec.args);
        let mut child = Command::new(&invocation.program)
            .args(&invocation.args)
            .current_dir(working_dir)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .with_context(|| format_spawn_error(&invocation))?;

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

impl Default for CodexAdapter {
    fn default() -> Self {
        Self::new(default_codex_command())
    }
}

pub fn default_codex_command() -> String {
    let path = env::var("PATH").unwrap_or_default();
    resolve_codex_command_from_path("codex", &path, |candidate| candidate.exists())
        .to_string_lossy()
        .to_string()
}

pub fn resolve_codex_command_from_path(
    command: &str,
    path_env: &str,
    exists: impl Fn(&PathBuf) -> bool,
) -> PathBuf {
    let command_path = PathBuf::from(command);
    if command_path.components().count() > 1 || exists(&command_path) {
        return command_path;
    }

    for directory in env::split_paths(path_env) {
        for candidate in command_candidates(&directory, command) {
            if exists(&candidate) {
                return candidate;
            }
        }
    }

    for directory in common_codex_directories() {
        for candidate in command_candidates(&directory, command) {
            if exists(&candidate) {
                return candidate;
            }
        }
    }

    command_path
}

fn command_candidates(directory: &std::path::Path, command: &str) -> Vec<PathBuf> {
    if cfg!(windows) && !command.contains('.') {
        return vec![
            directory.join(format!("{command}.cmd")),
            directory.join(format!("{command}.exe")),
            directory.join(format!("{command}.ps1")),
            directory.join(command),
        ];
    }
    vec![directory.join(command)]
}

fn common_codex_directories() -> Vec<PathBuf> {
    let mut directories = Vec::new();
    if cfg!(windows) {
        if let Some(appdata) = env::var_os("APPDATA") {
            directories.push(PathBuf::from(appdata).join("npm"));
        }
        directories.push(PathBuf::from("D:/nodejs"));
        directories.push(PathBuf::from("C:/Program Files/nodejs"));
    }
    directories
}

pub fn prepare_command_invocation(program: PathBuf, args: Vec<String>) -> ProcessInvocation {
    prepare_command_invocation_with_cmd(program, args, default_cmd_program)
}

pub fn prepare_command_invocation_with_cmd(
    program: PathBuf,
    args: Vec<String>,
    cmd_program: impl Fn() -> Option<PathBuf>,
) -> ProcessInvocation {
    if cfg!(windows) && program.extension().and_then(|value| value.to_str()) == Some("cmd") {
        let mut wrapped_args = vec!["/C".to_string(), program.to_string_lossy().to_string()];
        wrapped_args.extend(args);
        return ProcessInvocation {
            program: cmd_program()
                .unwrap_or_else(|| PathBuf::from("cmd"))
                .to_string_lossy()
                .to_string(),
            args: wrapped_args,
        };
    }
    ProcessInvocation {
        program: program.to_string_lossy().to_string(),
        args,
    }
}

fn default_cmd_program() -> Option<PathBuf> {
    env::var_os("COMSPEC")
        .map(PathBuf::from)
        .filter(|path| path.exists())
        .or_else(|| {
            let system_root = env::var_os("SystemRoot")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("C:/Windows"));
            let candidate = system_root.join("System32").join("cmd.exe");
            candidate.exists().then_some(candidate)
        })
}

pub fn format_spawn_error(invocation: &ProcessInvocation) -> String {
    format!(
        "failed to start Codex command: {} {}",
        invocation.program,
        invocation.args.join(" ")
    )
}

pub fn format_error_chain(error: &anyhow::Error) -> String {
    let mut parts = vec![error.to_string()];
    for cause in error.chain().skip(1) {
        parts.push(cause.to_string());
    }
    parts.join(" | caused by: ")
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
