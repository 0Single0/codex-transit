use std::{
    collections::HashSet,
    fs::{self, File},
    io::{BufRead, BufReader},
    path::{Component, Path, PathBuf},
};

use anyhow::Result;
use serde::Deserialize;
use serde_json::Value;

use crate::protocol::{CodexHistoryAttachment, CodexHistoryItem, CodexHistoryMessage};

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
    let project_session_ids = options
        .project_root
        .as_ref()
        .map(|project_root| collect_project_session_ids(codex_home, project_root))
        .transpose()?;
    let mut sessions = Vec::new();
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let parsed: SessionIndexLine = serde_json::from_str(&line)?;
        if let Some(project_session_ids) = &project_session_ids {
            if !project_session_ids.contains(&parsed.id) {
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
        let (cleaned_message, mut attachments) = extract_embedded_file_attachments(message);
        if cleaned_message.trim().is_empty() {
            continue;
        }
        attachments.extend(parse_history_attachments(payload));
        messages.push(CodexHistoryMessage {
            id: format!("{codex_session_id}-{index}"),
            role: if kind == "user_message" {
                "user".to_string()
            } else {
                "assistant".to_string()
            },
            text: cleaned_message,
            created_at: timestamp,
            attachments: (!attachments.is_empty()).then_some(attachments),
        });
    }
    Ok(messages)
}

fn parse_history_attachments(payload: &Value) -> Vec<CodexHistoryAttachment> {
    let mut attachments = Vec::new();

    if let Some(local_images) = payload.get("local_images").and_then(Value::as_array) {
        for (index, image) in local_images.iter().enumerate() {
            let Some(path) = image.as_str() else {
                continue;
            };
            let name = Path::new(path)
                .file_name()
                .and_then(|value| value.to_str())
                .map(str::to_string)
                .unwrap_or_else(|| format!("image-{}", index + 1));
            attachments.push(CodexHistoryAttachment {
                name,
                path: path.to_string(),
                mime_type: guess_mime_type(path),
                kind: "image".to_string(),
            });
        }
    }

    if let Some(images) = payload.get("images").and_then(Value::as_array) {
        for (index, image) in images.iter().enumerate() {
            let Some(path) = image.as_str() else {
                continue;
            };
            let name = Path::new(path)
                .file_name()
                .and_then(|value| value.to_str())
                .map(str::to_string)
                .unwrap_or_else(|| format!("image-{}", attachments.len() + index + 1));
            attachments.push(CodexHistoryAttachment {
                name,
                path: path.to_string(),
                mime_type: guess_mime_type(path),
                kind: "image".to_string(),
            });
        }
    }

    attachments
}

fn extract_embedded_file_attachments(message: &str) -> (String, Vec<CodexHistoryAttachment>) {
    const HEADER: &str = "\n\nAttached files available on disk:\n";
    const FOOTER: &str = "Use these files from the provided local paths when relevant.";

    let Some(header_index) = message.find(HEADER) else {
        return (message.to_string(), Vec::new());
    };

    let body_start = header_index + HEADER.len();
    let Some(footer_index) = message[body_start..].find(FOOTER).map(|index| body_start + index) else {
        return (message.to_string(), Vec::new());
    };

    let prefix = message[..header_index].trim_end().to_string();
    let body = &message[body_start..footer_index];
    let mut attachments = Vec::new();
    let mut lines = body.lines().peekable();

    while let Some(line) = lines.next() {
        let trimmed = line.trim();
        if !trimmed.starts_with("- ") {
            continue;
        }

        let name_part = trimmed.trim_start_matches("- ").trim();
        let (name, mime_type) = parse_name_and_mime(name_part);
        let Some(path_line) = lines.next() else {
            continue;
        };
        let path_trimmed = path_line.trim();
        let Some(path) = path_trimmed.strip_prefix("path: ").map(str::trim) else {
            continue;
        };

        attachments.push(CodexHistoryAttachment {
            name,
            path: path.to_string(),
            mime_type,
            kind: "file".to_string(),
        });
    }

    (prefix, attachments)
}

fn parse_name_and_mime(value: &str) -> (String, Option<String>) {
    let Some(open_index) = value.rfind(" [") else {
        return (value.to_string(), None);
    };
    if !value.ends_with(']') {
        return (value.to_string(), None);
    }

    let name = value[..open_index].trim().to_string();
    let mime_type = value[(open_index + 2)..(value.len() - 1)].trim().to_string();
    if name.is_empty() || mime_type.is_empty() {
        return (value.to_string(), None);
    }

    (name, Some(mime_type))
}

fn guess_mime_type(path: &str) -> Option<String> {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())?
        .to_ascii_lowercase();
    let mime_type = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        _ => return None,
    };
    Some(mime_type.to_string())
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

fn collect_project_session_ids(codex_home: &Path, project_root: &Path) -> Result<HashSet<String>> {
    let mut ids = HashSet::new();
    let normalized_project_root = normalize_path(project_root);
    for root in [
        codex_home.join("sessions"),
        codex_home.join("archived_sessions"),
    ] {
        if root.exists() {
            collect_project_session_ids_in_dir(&root, &normalized_project_root, &mut ids)?;
        }
    }
    Ok(ids)
}

fn collect_project_session_ids_in_dir(
    root: &Path,
    normalized_project_root: &str,
    ids: &mut HashSet<String>,
) -> Result<()> {
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_project_session_ids_in_dir(&path, normalized_project_root, ids)?;
        } else if path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.ends_with(".jsonl"))
        {
            if let Some((session_id, cwd)) = read_session_meta(&path)? {
                if normalize_path(&cwd) == normalized_project_root {
                    ids.insert(session_id);
                }
            }
        }
    }
    Ok(())
}

fn read_session_meta(path: &Path) -> Result<Option<(String, PathBuf)>> {
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
        let Some(payload) = value.get("payload") else {
            return Ok(None);
        };
        let Some(session_id) = payload.get("id").and_then(Value::as_str) else {
            return Ok(None);
        };
        let Some(cwd) = payload.get("cwd").and_then(Value::as_str) else {
            return Ok(None);
        };
        return Ok(Some((session_id.to_string(), PathBuf::from(cwd))));
    }
    Ok(None)
}

fn normalize_path(path: &Path) -> String {
    normalize_path_string(&path.to_string_lossy())
}

fn normalize_path_string(path: &str) -> String {
    let path = path
        .replace('\\', "/")
        .trim_start_matches("//?/")
        .trim_start_matches("//./")
        .to_string();
    let mut parts = Vec::new();
    for component in Path::new(&path).components() {
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
    parts.join("/").to_lowercase()
}
