use std::{collections::HashMap, path::PathBuf};

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectEntry {
    pub project_id: Uuid,
    pub display_name: String,
    pub path_alias: String,
    pub root: PathBuf,
    pub available: bool,
}

#[derive(Default)]
pub struct ProjectRegistry {
    projects: HashMap<Uuid, ProjectEntry>,
}

impl ProjectRegistry {
    pub fn add_project(&mut self, root: PathBuf) -> Result<ProjectEntry> {
        if !root.exists() || !root.is_dir() {
            bail!("project directory does not exist");
        }
        let display_name = root
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Project")
            .to_string();
        let entry = ProjectEntry {
            project_id: Uuid::new_v4(),
            path_alias: display_name.clone(),
            display_name,
            root,
            available: true
        };
        self.projects.insert(entry.project_id, entry.clone());
        Ok(entry)
    }

    pub fn get(&self, project_id: &Uuid) -> Option<&ProjectEntry> {
        self.projects.get(project_id)
    }

    pub fn list(&self) -> Vec<ProjectEntry> {
        self.projects.values().cloned().collect()
    }
}
