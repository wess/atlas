use atlasstore::Paths;

#[test]
fn parent_components_cannot_escape_the_root() {
    let paths = Paths::new("atlascontainstest");
    assert!(!paths.contains(&paths.root().join("../outside")));
    assert!(paths.contains(&paths.root().join("nested/missing.json")));
}

#[cfg(unix)]
#[test]
fn symlinks_to_other_roots_are_rejected() {
    let dir = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    let paths = Paths::new("atlaslinktest");
    let env = paths.env_var();
    std::env::set_var(&env, dir.path());
    std::os::unix::fs::symlink(outside.path(), dir.path().join("link")).unwrap();
    assert!(!paths.contains(&dir.path().join("link/missing.json")));
    std::env::remove_var(env);
}
