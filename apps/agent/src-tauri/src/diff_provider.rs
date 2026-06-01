use std::{path::Path, process::Command};

use anyhow::Result;

use crate::path_guard::resolve_inside;

pub trait ProjectDiffProvider {
    fn diff_file(&self, project_root: &Path, relative_path: &str) -> Result<String>;
}

#[derive(Default)]
pub struct GitDiffProvider;

pub fn diff_file(project_root: &Path, relative_path: &str) -> Result<String> {
    let _validated = resolve_inside(project_root, relative_path)?;
    let output = Command::new("git")
        .arg("diff")
        .arg("--")
        .arg(relative_path)
        .current_dir(project_root)
        .output()?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Ok(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

impl ProjectDiffProvider for GitDiffProvider {
    fn diff_file(&self, project_root: &Path, relative_path: &str) -> Result<String> {
        diff_file(project_root, relative_path)
    }
}
