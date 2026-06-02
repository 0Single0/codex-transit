use std::{env, path::PathBuf};

use anyhow::Result;
use tokio::fs;
use uuid::Uuid;

fn attachment_root() -> PathBuf {
    env::var_os("CODEX_TRANSIT_AGENT_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            env::var_os("APPDATA")
                .map(PathBuf::from)
                .or_else(|| env::var_os("HOME").map(PathBuf::from))
                .unwrap_or_else(std::env::temp_dir)
                .join("codex-transit-agent")
        })
        .join("attachments")
}

pub async fn materialize_attachment(source: &str, name: &str) -> Result<PathBuf> {
    if source.starts_with("http://") || source.starts_with("https://") {
        let response = reqwest::get(source).await?.error_for_status()?;
        let bytes = response.bytes().await?;
        let filename = format!("{}-{}", Uuid::new_v4(), sanitize_filename(name));
        let target = attachment_root().join(filename);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::write(&target, bytes).await?;
        return Ok(target);
    }

    Ok(PathBuf::from(source))
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|char| match char {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            other => other,
        })
        .collect()
}
