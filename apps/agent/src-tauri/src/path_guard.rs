use std::path::{Component, Path, PathBuf};

use anyhow::{bail, Result};

pub fn resolve_inside(root: &Path, relative_path: &str) -> Result<PathBuf> {
    let requested = Path::new(relative_path);
    if requested.is_absolute() {
        bail!("path is absolute");
    }

    for component in requested.components() {
        if matches!(component, Component::ParentDir | Component::RootDir | Component::Prefix(_)) {
            bail!("path resolves outside project");
        }
    }

    Ok(root.join(requested))
}
