use std::{
    env,
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::Result;
use uuid::Uuid;

pub fn append_trace_line(session_id: Uuid, line: &str) -> Result<PathBuf> {
    let path = ensure_session_log_file(session_id)?;
    let mut file = OpenOptions::new().create(true).append(true).open(&path)?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs_f64())
        .unwrap_or(0.0);
    writeln!(file, "[{timestamp:.3}] {line}")?;
    Ok(path)
}

pub fn ensure_session_log_file(session_id: Uuid) -> Result<PathBuf> {
    let path = session_log_path(session_id);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    if !path.exists() {
        OpenOptions::new().create(true).append(true).open(&path)?;
    }
    Ok(path)
}

pub fn ensure_session_output_file(session_id: Uuid) -> Result<PathBuf> {
    let path = session_output_path(session_id);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    if !path.exists() {
        OpenOptions::new().create(true).append(true).open(&path)?;
    }
    Ok(path)
}

fn default_agent_home() -> PathBuf {
    env::var_os("CODEX_TRANSIT_AGENT_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            env::var_os("APPDATA")
                .map(PathBuf::from)
                .or_else(|| env::var_os("HOME").map(PathBuf::from))
                .unwrap_or_else(env::temp_dir)
                .join("codex-transit-agent")
        })
}

pub fn session_log_path(session_id: Uuid) -> PathBuf {
    default_agent_home()
        .join("session-logs")
        .join(format!("{session_id}.log"))
}

pub fn session_output_path(session_id: Uuid) -> PathBuf {
    default_agent_home()
        .join("session-output")
        .join(format!("{session_id}.out.log"))
}
