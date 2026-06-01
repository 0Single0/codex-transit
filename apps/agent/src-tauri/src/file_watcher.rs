use std::{
    path::{Path, PathBuf},
    time::Duration,
};

use anyhow::Result;
use notify::{
    event::{CreateKind, ModifyKind, RemoveKind, RenameMode},
    Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FileChange {
    pub project_id: Uuid,
    pub relative_path: String,
    pub old_relative_path: Option<String>,
    pub change_type: String,
}

pub struct FileWatcher {
    _watcher: RecommendedWatcher,
}

pub fn event_to_file_changes(project_id: Uuid, root: &Path, event: Event) -> Vec<FileChange> {
    if matches!(
        event.kind,
        EventKind::Modify(ModifyKind::Name(RenameMode::Both))
    ) {
        return rename_change(project_id, root, &event.paths)
            .into_iter()
            .collect();
    }

    let Some(change_type) = change_type(&event.kind) else {
        return Vec::new();
    };
    event
        .paths
        .into_iter()
        .filter_map(|path| relative_path(root, &path))
        .map(|relative_path| FileChange {
            project_id,
            relative_path,
            old_relative_path: None,
            change_type: change_type.to_string(),
        })
        .collect()
}

impl FileWatcher {
    pub fn watch(root: PathBuf, tx: mpsc::Sender<Event>) -> Result<Self> {
        let mut watcher = RecommendedWatcher::new(
            move |result| {
                if let Ok(event) = result {
                    let _ = tx.blocking_send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_millis(500)),
        )?;
        watcher.watch(&root, RecursiveMode::Recursive)?;
        Ok(Self { _watcher: watcher })
    }

    pub fn watch_changes(
        project_id: Uuid,
        root: PathBuf,
        tx: mpsc::Sender<FileChange>,
    ) -> Result<Self> {
        let watched_root = root.clone();
        let mut watcher = RecommendedWatcher::new(
            move |result| {
                if let Ok(event) = result {
                    for change in event_to_file_changes(project_id, &root, event) {
                        let _ = tx.blocking_send(change);
                    }
                }
            },
            Config::default().with_poll_interval(Duration::from_millis(500)),
        )?;
        watcher.watch(&watched_root, RecursiveMode::Recursive)?;
        Ok(Self { _watcher: watcher })
    }
}

fn rename_change(project_id: Uuid, root: &Path, paths: &[PathBuf]) -> Option<FileChange> {
    let old_relative_path = paths.first().and_then(|path| relative_path(root, path))?;
    let relative_path = paths.get(1).and_then(|path| relative_path(root, path))?;
    Some(FileChange {
        project_id,
        relative_path,
        old_relative_path: Some(old_relative_path),
        change_type: "renamed".to_string(),
    })
}

fn change_type(kind: &EventKind) -> Option<&'static str> {
    match kind {
        EventKind::Create(CreateKind::Any | CreateKind::File | CreateKind::Other) => {
            Some("created")
        }
        EventKind::Modify(ModifyKind::Any | ModifyKind::Data(_) | ModifyKind::Other) => {
            Some("modified")
        }
        EventKind::Remove(RemoveKind::Any | RemoveKind::File | RemoveKind::Other) => {
            Some("deleted")
        }
        _ => None,
    }
}

fn relative_path(root: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(root)
        .ok()
        .and_then(|path| path.to_str())
        .map(|path| path.replace('\\', "/"))
        .filter(|path| !path.is_empty())
}
