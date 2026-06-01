use std::path::PathBuf;

use codex_transit_agent::file_watcher::event_to_file_changes;
use notify::{
    event::{CreateKind, ModifyKind, RemoveKind, RenameMode},
    Event, EventKind,
};

const PROJECT_ID: &str = "00000000-0000-4000-8000-000000000004";

#[test]
fn maps_modify_event_to_relative_file_change() {
    let root = PathBuf::from("C:/projects/demo");
    let event = Event::new(EventKind::Modify(ModifyKind::Any))
        .add_path(PathBuf::from("C:/projects/demo/src/main.rs"));

    let changes = event_to_file_changes(PROJECT_ID.parse().unwrap(), &root, event);

    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].relative_path, "src/main.rs");
    assert_eq!(changes[0].change_type, "modified");
}

#[test]
fn maps_create_and_remove_events() {
    let root = PathBuf::from("C:/projects/demo");
    let create = Event::new(EventKind::Create(CreateKind::File))
        .add_path(PathBuf::from("C:/projects/demo/src/new.rs"));
    let remove = Event::new(EventKind::Remove(RemoveKind::File))
        .add_path(PathBuf::from("C:/projects/demo/src/old.rs"));

    let created = event_to_file_changes(PROJECT_ID.parse().unwrap(), &root, create);
    let removed = event_to_file_changes(PROJECT_ID.parse().unwrap(), &root, remove);

    assert_eq!(created[0].change_type, "created");
    assert_eq!(created[0].relative_path, "src/new.rs");
    assert_eq!(removed[0].change_type, "deleted");
    assert_eq!(removed[0].relative_path, "src/old.rs");
}

#[test]
fn maps_rename_event_with_old_relative_path() {
    let root = PathBuf::from("C:/projects/demo");
    let event = Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::Both)))
        .add_path(PathBuf::from("C:/projects/demo/src/old.rs"))
        .add_path(PathBuf::from("C:/projects/demo/src/new.rs"));

    let changes = event_to_file_changes(PROJECT_ID.parse().unwrap(), &root, event);

    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].relative_path, "src/new.rs");
    assert_eq!(changes[0].old_relative_path, Some("src/old.rs".to_string()));
    assert_eq!(changes[0].change_type, "renamed");
}

#[test]
fn ignores_paths_outside_project_root() {
    let root = PathBuf::from("C:/projects/demo");
    let event = Event::new(EventKind::Modify(ModifyKind::Any))
        .add_path(PathBuf::from("C:/projects/other/src/main.rs"));

    let changes = event_to_file_changes(PROJECT_ID.parse().unwrap(), &root, event);

    assert!(changes.is_empty());
}
