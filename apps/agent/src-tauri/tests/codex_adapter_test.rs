use std::path::PathBuf;

use codex_transit_agent::codex_adapter::{
    prepare_command_invocation, resolve_codex_command_from_path, CodexAdapter, CodexExecOptions,
};

#[test]
fn builds_codex_exec_command_with_project_and_prompt_stdin() {
    let adapter = CodexAdapter::new("codex");
    let command = adapter.build_exec_command(
        PathBuf::from("C:/work/project"),
        CodexExecOptions {
            sandbox: Some("workspace-write".to_string()),
            model: Some("gpt-5".to_string()),
        },
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

#[test]
fn builds_codex_exec_resume_command_for_history_session() {
    let adapter = CodexAdapter::new("codex");
    let command = adapter.build_resume_command(
        PathBuf::from("C:/work/project"),
        "019e8268-8f45-7422-aff8-5524d4c6990b",
        CodexExecOptions::default(),
    );

    assert_eq!(command.program, "codex");
    assert_eq!(
        command.args,
        vec![
            "exec",
            "resume",
            "--skip-git-repo-check",
            "019e8268-8f45-7422-aff8-5524d4c6990b",
            "-"
        ]
    );
}

#[test]
fn resolves_codex_command_from_windows_path_entries() {
    let command =
        resolve_codex_command_from_path("codex", "D:/nodejs;C:/Windows/System32", |candidate| {
            candidate.ends_with("D:/nodejs/codex.cmd")
        });

    assert_eq!(command, PathBuf::from("D:/nodejs/codex.cmd"));
}

#[test]
fn prefers_windows_cmd_wrapper_over_extensionless_shim() {
    let command = resolve_codex_command_from_path("codex", "D:/nodejs", |candidate| {
        candidate.ends_with("D:/nodejs/codex") || candidate.ends_with("D:/nodejs/codex.cmd")
    });

    assert_eq!(command, PathBuf::from("D:/nodejs/codex.cmd"));
}

#[test]
fn prepares_windows_cmd_files_for_process_spawn() {
    let invocation = prepare_command_invocation(
        PathBuf::from("D:/nodejs/codex.cmd"),
        vec!["exec".to_string(), "-".to_string()],
    );

    if cfg!(windows) {
        assert_eq!(invocation.program, "cmd");
        assert_eq!(
            invocation.args,
            vec!["/C", "D:/nodejs/codex.cmd", "exec", "-"]
        );
    } else {
        assert_eq!(invocation.program, "D:/nodejs/codex.cmd");
        assert_eq!(invocation.args, vec!["exec", "-"]);
    }
}
