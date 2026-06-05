use std::{
    env,
    path::PathBuf,
    sync::OnceLock,
};

use anyhow::{Context, Result};
use serde_json::Value;
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    process::{Child, Command},
    sync::mpsc,
};
use uuid::Uuid;

use crate::path_utils::normalize_for_windows_process_path;

pub const CODEX_THREAD_ID_PREFIX: &str = "__CODEX_THREAD_ID__:";
pub const CODEX_TURN_COMPLETED_PREFIX: &str = "__CODEX_TURN_COMPLETED__:";
pub const CODEX_TURN_FAILED_PREFIX: &str = "__CODEX_TURN_FAILED__:";
pub const CODEX_TOOL_CALL_PREFIX: &str = "__CODEX_TOOL_CALL__:";

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
    pub approval_policy: Option<String>,
    pub plan_mode: bool,
    pub image_attachments: Vec<String>,
    pub file_attachments: Vec<CodexFileAttachment>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CodexFileAttachment {
    pub name: String,
    pub path: String,
    pub mime_type: Option<String>,
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
        build_codex_exec_command(
            self.command.clone(),
            working_dir,
            options,
            None,
        )
    }

    pub fn build_resume_command(
        &self,
        working_dir: PathBuf,
        codex_session_id: &str,
        options: CodexExecOptions,
    ) -> CodexExecCommand {
        build_codex_exec_command(
            self.command.clone(),
            working_dir,
            options,
            Some(codex_session_id.to_string()),
        )
    }

    pub async fn start(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        prompt: String,
        options: CodexExecOptions,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        let prompt = augment_prompt_with_file_attachments(prompt, &options.file_attachments);
        let prompt_via_stdin = requires_stdin_prompt(&options);
        let exec = self.build_exec_command(working_dir.clone(), options);
        let (exec, prompt_stdin) = attach_prompt(exec, prompt, prompt_via_stdin);
        self.spawn_command(session_id, working_dir, exec, output_tx, prompt_stdin)
            .await
    }

    pub async fn resume(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        codex_session_id: String,
        prompt: String,
        options: CodexExecOptions,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        let prompt = augment_prompt_with_file_attachments(prompt, &options.file_attachments);
        let prompt_via_stdin = requires_stdin_prompt(&options);
        let exec = self.build_resume_command(working_dir.clone(), &codex_session_id, options);
        let (exec, prompt_stdin) = attach_prompt(exec, prompt, prompt_via_stdin);
        self.spawn_command(session_id, working_dir, exec, output_tx, prompt_stdin)
            .await
    }

    async fn spawn_command(
        &self,
        session_id: Uuid,
        working_dir: PathBuf,
        exec: CodexExecCommand,
        output_tx: mpsc::Sender<ProcessOutput>,
        prompt_stdin: Option<String>,
    ) -> Result<CodexSessionProcess> {
        if should_open_visible_window(prompt_stdin.is_some()) {
            return self
                .spawn_windows_visible_codex(session_id, working_dir, exec, output_tx, prompt_stdin)
                .await;
        }

        let working_dir = normalize_for_windows_process_path(&working_dir);
        let invocation = prepare_command_invocation(PathBuf::from(exec.program), exec.args);
        let mut child = Command::new(&invocation.program)
            .args(&invocation.args)
            .current_dir(working_dir)
            .stdin(if prompt_stdin.is_some() { std::process::Stdio::piped() } else { std::process::Stdio::null() })
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .with_context(|| format_spawn_error(&invocation))?;
        if let Some(prompt_stdin) = prompt_stdin {
            if let Some(mut stdin) = child.stdin.take() {
                tokio::spawn(async move {
                    let _ = stdin.write_all(prompt_stdin.as_bytes()).await;
                    let _ = stdin.shutdown().await;
                });
            }
        }
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
        prompt_stdin: Option<String>,
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
        let command_exec = if prompt_stdin.is_some() {
            "$stdinText = [Console]::In.ReadToEnd(); \
if ($stdinText.Length -gt 0) { \
  $stdinText | & $cmd[0] @($cmd[1..($cmd.Length-1)]); \
} else { \
  & $cmd[0] @($cmd[1..($cmd.Length-1)]); \
}"
        } else {
            "& $cmd[0] @($cmd[1..($cmd.Length-1)]);"
        };
        let script = format!(
            "$ErrorActionPreference='Stop'; \
$Host.UI.RawUI.WindowTitle='{title}'; \
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false); \
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); \
Write-Output '{marker}'; \
$cmd = @('{program}'{args}); \
{command_exec} \
if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}",
            marker = escape_ps_single_quoted(marker),
            program = escape_ps_single_quoted(&invocation.program),
            args = invocation
                .args
                .iter()
                .map(|arg| format!(", '{}'", escape_ps_single_quoted(arg)))
                .collect::<String>(),
            command_exec = command_exec,
        );

        let mut child = Command::new("powershell")
            .arg("-NoLogo")
            .arg("-NoExit")
            .arg("-Command")
            .arg(script)
            .current_dir(normalized_working_dir)
            .stdin(if prompt_stdin.is_some() { std::process::Stdio::piped() } else { std::process::Stdio::null() })
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .with_context(|| format_spawn_error(&invocation))?;
        if let Some(prompt_stdin) = prompt_stdin {
            if let Some(mut stdin) = child.stdin.take() {
                tokio::spawn(async move {
                    let _ = stdin.write_all(prompt_stdin.as_bytes()).await;
                    let _ = stdin.shutdown().await;
                });
            }
        }

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
        _prompt_stdin: Option<String>,
    ) -> Result<CodexSessionProcess> {
        unreachable!()
    }
}

impl Default for CodexAdapter {
    fn default() -> Self {
        Self::new(default_codex_command())
    }
}

fn build_codex_exec_command(
    program: String,
    working_dir: PathBuf,
    options: CodexExecOptions,
    resume_session_id: Option<String>,
) -> CodexExecCommand {
    let normalized_working_dir = normalize_for_windows_process_path(&working_dir);
    let mut args = vec!["exec".to_string()];
    let working_dir_arg = normalized_working_dir.to_string_lossy().replace('\\', "/");

    if let Some(codex_session_id) = resume_session_id {
        args.push("--cd".to_string());
        args.push(working_dir_arg);
        args.push("--json".to_string());
        args.push("resume".to_string());
        if let Some(model) = options.model {
            args.push("--model".to_string());
            args.push(model);
        }
        if let Some(approval_policy) = options.approval_policy {
            match approval_policy.as_str() {
                "full" => args.push("--dangerously-bypass-approvals-and-sandbox".to_string()),
                "auto" => args.push("--full-auto".to_string()),
                _ => {}
            }
        }
        for attachment in options.image_attachments {
            args.push("--image".to_string());
            args.push(attachment);
        }
        args.push("--skip-git-repo-check".to_string());
        args.push(codex_session_id);
        return CodexExecCommand { program, args };
    }

    args.push("--cd".to_string());
    args.push(working_dir_arg);
    args.push("--json".to_string());
    if let Some(sandbox) = options.sandbox {
        args.push("--sandbox".to_string());
        args.push(sandbox);
    }
    if let Some(model) = options.model {
        args.push("--model".to_string());
        args.push(model);
    }
    if let Some(approval_policy) = options.approval_policy {
        match approval_policy.as_str() {
            "full" => args.push("--dangerously-bypass-approvals-and-sandbox".to_string()),
            "auto" => args.push("--full-auto".to_string()),
            _ => {}
        }
    }
    for attachment in options.image_attachments {
        args.push("--image".to_string());
        args.push(attachment);
    }
    if options.plan_mode {
        args.push("-c".to_string());
        args.push(r#"model_reasoning_effort="high""#.to_string());
    }
    CodexExecCommand { program, args }
}

fn augment_prompt_with_file_attachments(
    prompt: String,
    attachments: &[CodexFileAttachment],
) -> String {
    if attachments.is_empty() {
        return prompt;
    }

    let mut suffix = String::from("\n\nAttached files available on disk:\n");
    for attachment in attachments {
        suffix.push_str("- ");
        suffix.push_str(&attachment.name);
        if let Some(mime_type) = &attachment.mime_type {
            suffix.push_str(" [");
            suffix.push_str(mime_type);
            suffix.push(']');
        }
        suffix.push_str("\n  path: ");
        suffix.push_str(&attachment.path);
        suffix.push('\n');
    }
    suffix.push_str("Use these files from the provided local paths when relevant.");

    format!("{prompt}{suffix}")
}

fn requires_stdin_prompt(options: &CodexExecOptions) -> bool {
    !options.image_attachments.is_empty()
}

fn attach_prompt(
    mut exec: CodexExecCommand,
    prompt: String,
    prompt_via_stdin: bool,
) -> (CodexExecCommand, Option<String>) {
    if prompt_via_stdin {
        exec.args.push("-".to_string());
        return (exec, Some(prompt));
    }

    exec.args.push(prompt);
    (exec, None)
}

fn should_open_visible_window(prompt_via_stdin: bool) -> bool {
    cfg!(windows)
        && !prompt_via_stdin
        && env::var("CODEX_TRANSIT_OPEN_CODEX_WINDOW").unwrap_or_else(|_| "1".to_string()) != "0"
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

    if kind == "item.started" || kind == "item.completed" {
        let Some(item) = value.get("item") else {
            return;
        };
        let Some(item_type) = item.get("type").and_then(Value::as_str) else {
            return;
        };
        if item_type == "agent_message" && kind == "item.completed" {
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
            return;
        }

        if item_type == "command_execution" {
            let item_id = item.get("id").and_then(Value::as_str).unwrap_or_default();
            let command = item.get("command").and_then(Value::as_str).unwrap_or_default();
            let status = item.get("status").and_then(Value::as_str).unwrap_or_default();
            let output = item
                .get("aggregated_output")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let exit_code = item
                .get("exit_code")
                .and_then(Value::as_i64)
                .map(|value| value as i32)
                .unwrap_or(-99999);

            let payload = serde_json::json!({
                "itemId": item_id,
                "command": command,
                "status": status,
                "output": if output.is_empty() { Value::Null } else { Value::String(output.to_string()) },
                "exitCode": if exit_code == -99999 { Value::Null } else { Value::from(exit_code) }
            });

            let _ = output_tx
                .send(ProcessOutput {
                    session_id,
                    stream: OutputStream::Stdout,
                    text: format!("{CODEX_TOOL_CALL_PREFIX}{payload}"),
                })
                .await;
        }
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attach_prompt_uses_stdin_when_requested() {
        let exec = CodexExecCommand {
            program: "codex".to_string(),
            args: vec!["exec".to_string()],
        };

        let (exec, prompt_stdin) = attach_prompt(exec, "hello".to_string(), true);

        assert_eq!(exec.args, vec!["exec".to_string(), "-".to_string()]);
        assert_eq!(prompt_stdin.as_deref(), Some("hello"));
    }

    #[test]
    fn attach_prompt_keeps_cli_argument_without_stdin() {
        let exec = CodexExecCommand {
            program: "codex".to_string(),
            args: vec!["exec".to_string()],
        };

        let (exec, prompt_stdin) = attach_prompt(exec, "hello".to_string(), false);

        assert_eq!(exec.args, vec!["exec".to_string(), "hello".to_string()]);
        assert!(prompt_stdin.is_none());
    }

    #[test]
    fn visible_window_is_disabled_for_stdin_prompt() {
        assert!(!should_open_visible_window(true));
    }
}
