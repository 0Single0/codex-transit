use std::{
    fs::{self, File},
    io::{BufRead, BufReader},
    path::{Component, Path, PathBuf},
};

use anyhow::Result;
use serde::Deserialize;
use serde_json::Value;

use crate::protocol::{CodexHistoryItem, CodexHistoryMessage};

pub struct CodexHistoryListOptions {
    pub limit: usize,
    pub project_root: Option<PathBuf>,
}

#[derive(Deserialize)]
struct SessionIndexLine {
    id: String,
    thread_name: Option<String>,
    updated_at: String,
}

pub fn default_codex_home() -> PathBuf {
    std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::var_os("USERPROFILE")
                .map(PathBuf::from)
                .or_else(|| std::env::var_os("HOME").map(PathBuf::from))
                .unwrap_or_else(std::env::temp_dir)
                .join(".codex")
        })
}

pub fn list_codex_history(options: CodexHistoryListOptions) -> Result<Vec<CodexHistoryItem>> {
    list_codex_history_from_home(&default_codex_home(), options)
}

pub fn list_codex_history_from_home(
    codex_home: &Path,
    options: CodexHistoryListOptions,
) -> Result<Vec<CodexHistoryItem>> {
    let index_path = codex_home.join("session_index.jsonl");
    if !index_path.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(index_path)?;
    let reader = BufReader::new(file);
    let mut sessions = Vec::new();
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let parsed: SessionIndexLine = serde_json::from_str(&line)?;
        if let Some(project_root) = &options.project_root {
            if !session_belongs_to_project(codex_home, &parsed.id, project_root)? {
                continue;
            }
        }
        sessions.push(CodexHistoryItem {
            codex_session_id: parsed.id,
            title: parsed
                .thread_name
                .unwrap_or_else(|| "Codex 会话".to_string()),
            updated_at: parsed.updated_at,
            preview: None,
        });
    }

    sessions.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    sessions.truncate(options.limit);
    Ok(sessions)
}

pub fn load_codex_history_messages(codex_session_id: &str) -> Result<Vec<CodexHistoryMessage>> {
    load_codex_history_messages_from_home(&default_codex_home(), codex_session_id)
}

pub fn load_codex_history_messages_from_home(
    codex_home: &Path,
    codex_session_id: &str,
) -> Result<Vec<CodexHistoryMessage>> {
    let Some(path) = find_session_file(codex_home, codex_session_id)? else {
        return Ok(Vec::new());
    };
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let mut messages = Vec::new();
    for (index, line) in reader.lines().enumerate() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let timestamp = value
            .get("timestamp")
            .and_then(Value::as_str)
            .map(str::to_string);
        let Some(payload) = value.get("payload") else {
            continue;
        };
        let Some(kind) = payload.get("type").and_then(Value::as_str) else {
            continue;
        };
        if kind != "user_message" && kind != "agent_message" {
            continue;
        }
        let Some(message) = payload.get("message").and_then(Value::as_str) else {
            continue;
        };
        if message.trim().is_empty() {
            continue;
        }
        messages.push(CodexHistoryMessage {
            id: format!("{codex_session_id}-{index}"),
            role: if kind == "user_message" {
                "user".to_string()
            } else {
                "assistant".to_string()
            },
            text: message.to_string(),
            created_at: timestamp,
        });
    }
    Ok(messages)
}

fn find_session_file(codex_home: &Path, codex_session_id: &str) -> Result<Option<PathBuf>> {
    let roots = [
        codex_home.join("sessions"),
        codex_home.join("archived_sessions"),
    ];
    for root in roots {
        if !root.exists() {
            continue;
        }
        if let Some(path) = find_session_file_in_dir(&root, codex_session_id)? {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

fn find_session_file_in_dir(root: &Path, codex_session_id: &str) -> Result<Option<PathBuf>> {
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_session_file_in_dir(&path, codex_session_id)? {
                return Ok(Some(found));
            }
        } else if path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.contains(codex_session_id) && name.ends_with(".jsonl"))
        {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

fn session_belongs_to_project(
    codex_home: &Path,
    codex_session_id: &str,
    project_root: &Path,
) -> Result<bool> {
    let Some(path) = find_session_file(codex_home, codex_session_id)? else {
        return Ok(false);
    };
    let Some(cwd) = read_session_cwd(&path)? else {
        return Ok(false);
    };
    Ok(normalize_path(&cwd) == normalize_path(project_root))
}

fn read_session_cwd(path: &Path) -> Result<Option<PathBuf>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        if value.get("type").and_then(Value::as_str) != Some("session_meta") {
            continue;
        }
        return Ok(value
            .get("payload")
            .and_then(|payload| payload.get("cwd"))
            .and_then(Value::as_str)
            .map(PathBuf::from));
    }
    Ok(None)
}

fn normalize_path(path: &Path) -> String {
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => {
                parts.push(prefix.as_os_str().to_string_lossy().to_string())
            }
            Component::RootDir | Component::CurDir => {}
            Component::ParentDir => {
                parts.pop();
            }
            Component::Normal(value) => parts.push(value.to_string_lossy().to_string()),
        }
    }
    parts.join("/").replace('\\', "/").to_lowercase()
}
