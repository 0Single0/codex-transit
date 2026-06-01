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

fn temp_file(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("{}-{}", uuid::Uuid::new_v4(), name))
}
