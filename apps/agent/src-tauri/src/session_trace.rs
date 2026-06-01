use std::{
    env,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::Result;
use uuid::Uuid;

pub fn append_trace_line(session_id: Uuid, line: &str) -> Result<PathBuf> {
    let path = session_log_path(session_id);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut file = OpenOptions::new().create(true).append(true).open(&path)?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs_f64())
        .unwrap_or(0.0);
    writeln!(file, "[{timestamp:.3}] {line}")?;
    Ok(path)
}

pub fn maybe_open_trace_console(session_id: Uuid, log_path: &Path) -> Result<()> {
    #[cfg(windows)]
    {
        open_trace_console_windows(session_id, log_path)?;
    }
    Ok(())
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

fn session_log_path(session_id: Uuid) -> PathBuf {
    default_agent_home()
        .join("session-logs")
        .join(format!("{session_id}.log"))
}

#[cfg(windows)]
fn open_trace_console_windows(session_id: Uuid, log_path: &Path) -> Result<()> {
    use std::{
        collections::HashSet,
        os::windows::process::CommandExt,
        process::Command,
        sync::{Mutex, OnceLock},
    };

    static OPENED: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    let opened = OPENED.get_or_init(|| Mutex::new(HashSet::new()));
    let key = session_id.to_string();
    {
        let mut guard = opened.lock().map_err(|_| anyhow::anyhow!("trace lock poisoned"))?;
        if guard.contains(&key) {
            return Ok(());
        }
        guard.insert(key.clone());
    }

    const CREATE_NEW_CONSOLE: u32 = 0x00000010;
    let title = format!("Codex Transit Session {key}");
    let path = log_path.to_string_lossy().replace('\'', "''");
    let command = format!(
        "$Host.UI.RawUI.WindowTitle = '{title}'; Get-Content -LiteralPath '{path}' -Tail 120 -Wait"
    );
    Command::new("powershell")
        .arg("-NoLogo")
        .arg("-NoExit")
        .arg("-Command")
        .arg(command)
        .creation_flags(CREATE_NEW_CONSOLE)
        .spawn()?;
    Ok(())
}
