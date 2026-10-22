use atlasstore::json;

#[test]
fn simultaneous_writes_leave_one_complete_document() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("state.json");
    let writers: Vec<_> = (0..16)
        .map(|id| {
            let path = path.clone();
            std::thread::spawn(move || {
                for _ in 0..8 {
                    json::write(&path, &vec![id; 1024]).unwrap();
                }
            })
        })
        .collect();
    for writer in writers {
        writer.join().unwrap();
    }
    let result: Vec<u32> = json::read(&path).unwrap().unwrap();
    assert_eq!(result.len(), 1024);
    assert!(result.iter().all(|id| *id == result[0]));
    assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
}

#[cfg(unix)]
#[test]
fn documents_are_private_and_predictable_temp_symlinks_are_never_followed() {
    use std::os::unix::{fs::symlink, fs::PermissionsExt};
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("state.json");
    let victim = dir.path().join("victim");
    std::fs::write(&victim, "untouched").unwrap();
    symlink(&victim, path.with_extension("json.tmp")).unwrap();
    json::write(&path, &vec![1, 2, 3]).unwrap();
    assert_eq!(std::fs::read_to_string(&victim).unwrap(), "untouched");
    assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
}
