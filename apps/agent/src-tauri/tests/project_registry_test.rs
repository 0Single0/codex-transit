use std::{fs, path::PathBuf};

use codex_transit_agent::project_registry::ProjectRegistry;

#[test]
fn adding_same_project_path_reuses_existing_entry() {
    let mut registry = ProjectRegistry::default();
    let root = std::env::temp_dir();

    let first = registry.add_project(root.clone()).unwrap();
    let second = registry.add_project(root).unwrap();

    assert_eq!(first.project_id, second.project_id);
    assert_eq!(registry.list().len(), 1);
}

#[test]
fn saves_and_loads_project_registry() {
    let mut registry = ProjectRegistry::default();
    let project = registry.add_project(std::env::temp_dir()).unwrap();
    let file = temp_file("codex-transit-projects.json");

    registry.save_to_file(&file).unwrap();
    let loaded = ProjectRegistry::load_from_file(&file).unwrap();

    fs::remove_file(file).ok();
    assert_eq!(loaded.list().first().unwrap().project_id, project.project_id);
}

#[test]
fn missing_registry_file_loads_empty() {
    let file = temp_file("missing-codex-transit-projects.json");
    fs::remove_file(&file).ok();

    let loaded = ProjectRegistry::load_from_file(&file).unwrap();

    assert!(loaded.list().is_empty());
}

#[cfg(windows)]
#[test]
fn loading_registry_normalizes_windows_verbatim_root_paths() {
    let file = temp_file("codex-transit-projects-verbatim.json");
    fs::write(
        &file,
        r#"[
  {
    "project_id": "00000000-0000-4000-8000-000000000010",
    "display_name": "codex-transit",
    "path_alias": "codex-transit",
    "root": "\\\\?\\E:\\code\\codex-transit",
    "available": true
  }
]"#,
    )
    .unwrap();

    let loaded = ProjectRegistry::load_from_file(&file).unwrap();
    fs::remove_file(file).ok();
    let entry = loaded.list().pop().unwrap();
    assert_eq!(entry.root, PathBuf::from("E:\\code\\codex-transit"));
}

fn temp_file(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("{}-{}", uuid::Uuid::new_v4(), name))
}
