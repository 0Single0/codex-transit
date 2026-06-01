use std::path::PathBuf;

use codex_transit_agent::codex_adapter::{CodexAdapter, CodexExecOptions};

#[test]
fn builds_codex_exec_command_with_project_and_prompt_stdin() {
    let adapter = CodexAdapter::new("codex");
    let command = adapter.build_exec_command(
        PathBuf::from("C:/work/project"),
        CodexExecOptions {
            sandbox: Some("workspace-write".to_string()),
            model: Some("gpt-5".to_string())
        }
    );

    assert_eq!(command.program, "codex");
    assert_eq!(
        command.args,
        vec![
            "exec",
            "--cd",
            "C:/work/project",
            "--sandbox",
            "workspace-write",
            "--model",
            "gpt-5",
            "-"
        ]
    );
}
