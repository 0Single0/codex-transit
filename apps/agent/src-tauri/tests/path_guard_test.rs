use std::path::PathBuf;

use codex_transit_agent::path_guard::resolve_inside;

#[test]
fn accepts_relative_path_inside_root() {
    let root = PathBuf::from("C:/work/project");
    let resolved = resolve_inside(&root, "src/main.rs").unwrap();
    assert!(resolved.ends_with("src/main.rs"));
}

#[test]
fn rejects_parent_traversal() {
    let root = PathBuf::from("C:/work/project");
    let err = resolve_inside(&root, "../secret.txt").unwrap_err();
    assert!(err.to_string().contains("outside project"));
}
