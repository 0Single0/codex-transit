use std::{path::PathBuf, time::Duration};

use anyhow::Result;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::mpsc;

pub struct FileWatcher {
    _watcher: RecommendedWatcher
}

impl FileWatcher {
    pub fn watch(root: PathBuf, tx: mpsc::Sender<Event>) -> Result<Self> {
        let mut watcher = RecommendedWatcher::new(
            move |result| {
                if let Ok(event) = result {
                    let _ = tx.blocking_send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_millis(500))
        )?;
        watcher.watch(&root, RecursiveMode::Recursive)?;
        Ok(Self { _watcher: watcher })
    }
}
