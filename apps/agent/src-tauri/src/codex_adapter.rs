use std::{
    env,
    path::PathBuf,
    sync::OnceLock,
};

use anyhow::{Context, Result};
use serde_json::Value;
use tokio::{
    io::{AsyncRead, AsyncReadExt},
    process::{Child, Command},
    sync::mpsc,
};
use uuid::Uuid;

use crate::path_utils::normalize_for_windows_process_path;

pub const CODEX_THREAD_ID_PREFIX: &str = "__CODEX_THREAD_ID__:";
pub const CODEX_TURN_COMPLETED_PREFIX: &str = "__CODEX_TURN_COMPLETED__:";
pub const CODEX_TURN_FAILED_PREFIX: &str = "__CODEX_TURN_FAILED__:";

#[derive(Debug)]
pub struct ProcessOutput {
    pub session_id: Uuid,
    pub stream: OutputStream,
    pub text: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum OutputStream {
    Stdout,
    Stderr,
}

pub struct CodexSessionProcess {
    child: Child,
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

    pub fn build_exec_command(&self, working_dir: PathBuf, options: CodexExecOptions) -> CodexExecCommand {
        let normalized_working_dir = normalize_for_windows_process_path(&working_dir);
        let mut args = vec![
            "exec".to_string(),
            "--cd".to_string(),
            normalized_working_dir.to_string_lossy().replace('\\', "/"),
            "--json".to_string(),
        ];
        if let Some(sandbox) = options.sandbox {
            args.push("--sandbox".to_string());
            args.push(sandbox);
        }
        if let Some(model) = options.model {
            args.push("--model".to_string());
            args.push(model);
        }
        CodexExecCommand {
            program: self.command.clone(),
            args,
        }
    }

    pub fn build_resume_command(
        &self,
        working_dir: PathBuf,
        codex_session_id: &str,
        options: CodexExecOptions,
    ) -> CodexExecCommand {
        let normalized_working_dir = normalize_for_windows_process_path(&working_dir);
        let mut args = vec![
            "exec".to_string(),
            "--cd".to_string(),
            normalized_working_dir.to_string_lossy().replace('\\', "/"),
            "--json".to_string(),
        ];
        if let Some(sandbox) = options.sandbox {
            args.push("--sandbox".to_string());
            args.push(sandbox);
        }
        if let Some(model) = options.model {
            args.push("--model".to_string());
            args.push(model);
        }
        args.extend(vec![
            "resume".to_string(),
            "--skip-git-repo-check".to_string(),
            codex_session_id.to_string(),
        ]);
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
        model: Option<String>,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        let mut exec = self.build_exec_command(working_dir.clone(), CodexExecOptions {
            sandbox: None,
            model,
        });
        exec.args.push(prompt);
        self.spawn_command(session_id, working_dir, exec, output_tx)
            .await
    }

    pub async fn resume(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        codex_session_id: String,
        prompt: String,
        model: Option<String>,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        let mut exec = self.build_resume_command(
            working_dir.clone(),
            &codex_session_id,
            CodexExecOptions {
                sandbox: None,
                model,
            },
        );
        exec.args.push(prompt);
        self.spawn_command(session_id, working_dir, exec, output_tx)
            .await
    }

    async fn spawn_command(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        exec: CodexExecCommand,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        if cfg!(windows) && env::var("CODEX_TRANSIT_OPEN_CODEX_WINDOW").unwrap_or_else(|_| "1".to_string()) != "0" {
            return self
                .spawn_windows_visible_codex(session_id, working_dir, exec, output_tx)
                .await;
        }

        let working_dir = normalize_for_windows_process_path(&working_dir);
        let invocation = prepare_command_invocation(PathBuf::from(exec.program), exec.args);
        let mut child = Command::new(&invocation.program)
            .args(&invocation.args)
            .current_dir(working_dir)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .with_context(|| format_spawn_error(&invocation))?;
        if let Some(stdout) = child.stdout.take() {
            let tx = output_tx.clone();
            tokio::spawn(async move {
                forward_codex_json_output(stdout, session_id, tx, None).await;
            });
        }
        if let Some(stderr) = child.stderr.take() {
            maybe_forward_stderr(stderr, session_id, output_tx);
        }

        Ok(CodexSessionProcess { child })
    }

    #[cfg(windows)]
    async fn spawn_windows_visible_codex(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        exec: CodexExecCommand,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        static START_MARKER: OnceLock<String> = OnceLock::new();
        let marker = START_MARKER.get_or_init(|| {
            format!(
                "=== CODEX_TRANSIT_START_{} ===",
                uuid::Uuid::new_v4().simple()
            )
        });

        let normalized_working_dir = normalize_for_windows_process_path(&working_dir);
        let invocation = prepare_command_invocation(PathBuf::from(exec.program), exec.args);
        let title = format!("Codex {}", session_id);
        let script = format!(
            "$ErrorActionPreference='Stop'; \
$Host.UI.RawUI.WindowTitle='{title}'; \
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false); \
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); \
Write-Output '{marker}'; \
$cmd = @('{program}'{args}); \
& $cmd[0] @($cmd[1..($cmd.Length-1)]); \
if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}",
            marker = escape_ps_single_quoted(marker),
            program = escape_ps_single_quoted(&invocation.program),
            args = invocation
                .args
                .iter()
                .map(|arg| format!(", '{}'", escape_ps_single_quoted(arg)))
                .collect::<String>(),
        );

        let mut child = Command::new("powershell")
            .arg("-NoLogo")
            .arg("-NoExit")
            .arg("-Command")
            .arg(script)
            .current_dir(normalized_working_dir)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .with_context(|| format_spawn_error(&invocation))?;

        if let Some(stdout) = child.stdout.take() {
            let marker = marker.clone();
            let tx = output_tx.clone();
            tokio::spawn(async move {
                forward_codex_json_output(stdout, session_id, tx, Some(&marker)).await;
            });
        }
        if let Some(stderr) = child.stderr.take() {
            maybe_forward_stderr(stderr, session_id, output_tx);
        }

        Ok(CodexSessionProcess { child })
    }

    #[cfg(not(windows))]
    async fn spawn_windows_visible_codex(
        &self,
        _session_id: Uuid,
        _working_dir: PathBuf,
        _exec: CodexExecCommand,
        _output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        unreachable!()
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
            directory.join(format!("{command}.exe")),
            directory.join(format!("{command}.cmd")),
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

#[cfg(windows)]
fn escape_ps_single_quoted(value: &str) -> String {
    value.replace('\'', "''")
}

fn maybe_forward_stderr<R: AsyncRead + Unpin + Send + 'static>(
    stderr: R,
    session_id: Uuid,
    output_tx: mpsc::Sender<ProcessOutput>,
) {
    let forward_stderr = env::var("CODEX_TRANSIT_FORWARD_STDERR")
        .map(|value| value == "1")
        .unwrap_or(false);
    if !forward_stderr {
        return;
    }
    tokio::spawn(async move {
        let mut stderr = stderr;
        let mut buffer = vec![0_u8; 4096];
        loop {
            let Ok(read) = stderr.read(&mut buffer).await else {
                break;
            };
            if read == 0 {
                break;
            }
            let text = String::from_utf8_lossy(&buffer[..read]).to_string();
            let _ = output_tx
                .send(ProcessOutput {
                    session_id,
                    stream: OutputStream::Stderr,
                    text,
                })
                .await;
        }
    });
}

async fn forward_codex_json_output<R: AsyncRead + Unpin>(
    mut reader: R,
    session_id: Uuid,
    output_tx: mpsc::Sender<ProcessOutput>,
    start_marker: Option<&str>,
) {
    let mut buffer = vec![0_u8; 4096];
    let mut pending = String::new();
    let mut started = start_marker.is_none();
    loop {
        let Ok(read) = reader.read(&mut buffer).await else {
            break;
        };
        if read == 0 {
            break;
        }
        pending.push_str(&String::from_utf8_lossy(&buffer[..read]));

        while let Some(index) = pending.find('\n') {
            let mut line = pending[..index].to_string();
            pending = pending[(index + 1)..].to_string();
            line = line.trim_end_matches('\r').to_string();
            if line.is_empty() {
                continue;
            }
            if !started {
                if let Some(marker) = start_marker {
                    if line == marker {
                        started = true;
                    }
                }
                continue;
            }
            handle_codex_json_line(&line, session_id, &output_tx).await;
        }
    }
    if started && !pending.trim().is_empty() {
        handle_codex_json_line(pending.trim(), session_id, &output_tx).await;
    }
}

async fn handle_codex_json_line(line: &str, session_id: Uuid, output_tx: &mpsc::Sender<ProcessOutput>) {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return;
    };
    let Some(kind) = value.get("type").and_then(Value::as_str) else {
        return;
    };
    if kind == "thread.started" {
        if let Some(thread_id) = value.get("thread_id").and_then(Value::as_str) {
            let _ = output_tx
                .send(ProcessOutput {
                    session_id,
                    stream: OutputStream::Stdout,
                    text: format!("{CODEX_THREAD_ID_PREFIX}{thread_id}"),
                })
                .await;
        }
        return;
    }
    if kind == "turn.completed" {
        let turn_id = value
            .get("turn_id")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let _ = output_tx
            .send(ProcessOutput {
                session_id,
                stream: OutputStream::Stdout,
                text: format!("{CODEX_TURN_COMPLETED_PREFIX}{turn_id}"),
            })
            .await;
        return;
    }
    if kind == "turn.failed" {
        let turn_id = value
            .get("turn_id")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let message = value
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("Codex turn failed");
        let _ = output_tx
            .send(ProcessOutput {
                session_id,
                stream: OutputStream::Stdout,
                text: format!("{CODEX_TURN_FAILED_PREFIX}{turn_id}|{message}"),
            })
            .await;
        return;
    }
    if kind != "item.completed" {
        return;
    }
    let Some(item) = value.get("item") else {
        return;
    };
    if item.get("type").and_then(Value::as_str) != Some("agent_message") {
        return;
    }
    let Some(text) = item.get("text").and_then(Value::as_str) else {
        return;
    };
    if text.trim().is_empty() {
        return;
    }
    let _ = output_tx
        .send(ProcessOutput {
            session_id,
            stream: OutputStream::Stdout,
            text: text.to_string(),
        })
        .await;
}

pub fn format_error_chain(error: &anyhow::Error) -> String {
    let mut parts = vec![error.to_string()];
    for cause in error.chain().skip(1) {
        parts.push(cause.to_string());
    }
    parts.join(" | caused by: ")
}

pub fn describe_invocation(invocation: &ProcessInvocation, cwd: &std::path::Path) -> String {
    format!(
        "program={} args=[{}] cwd={}",
        invocation.program,
        invocation.args.join(" "),
        cwd.to_string_lossy()
    )
}

impl CodexSessionProcess {
    pub async fn send_input(&mut self, text: &str) -> Result<()> {
        let _ = text;
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<()> {
        self.child.kill().await?;
        Ok(())
    }
}
