#[cfg(target_os = "linux")]
#[test]
fn credentials_keep_the_existing_kernel_key_identity() {
  use atlasstore::Keychain;
  use keyring_core::api::CredentialStoreApi;
  use std::collections::HashMap;
  use std::time::{SystemTime, UNIX_EPOCH};

  let id = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
  let service = format!("io.wess.atlas.tests.{}.{}", std::process::id(), id);
  let description = format!("keyring-rs:legacy@{service}");
  let modifiers = HashMap::from([("description", description.as_str())]);
  let legacy = linux_keyutils_keyring_store::Store::new()
    .unwrap()
    .build(&service, "legacy", Some(&modifiers))
    .unwrap();
  legacy.set_password("previous-test-value").unwrap();

  let vault = Keychain::new(&service);
  let previous = vault.get("legacy");
  let written = vault.put("legacy", "updated-test-value");
  let updated = legacy.get_password();
  vault.delete("legacy");
  let removed = matches!(legacy.get_password(), Err(keyring_core::Error::NoEntry));
  let _ = legacy.delete_credential();

  assert_eq!(previous.as_deref(), Some("previous-test-value"));
  assert!(written);
  assert_eq!(updated.unwrap(), "updated-test-value");
  assert!(removed);
}

#[cfg(target_os = "windows")]
#[test]
fn credentials_keep_the_existing_windows_identity_and_encoding() {
  use atlasstore::Keychain;
  use std::time::{SystemTime, UNIX_EPOCH};
  use windows_sys::Win32::Foundation::{GetLastError, ERROR_NOT_FOUND};
  use windows_sys::Win32::Security::Credentials::{
    CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_ENTERPRISE,
    CRED_TYPE_GENERIC,
  };

  let id = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
  let service = format!("io.wess.atlas.tests.{}.{}", std::process::id(), id);
  let mut target: Vec<u16> = format!("legacy.{service}").encode_utf16().chain([0]).collect();
  let mut user: Vec<u16> = "legacy".encode_utf16().chain([0]).collect();
  let original = "previous-test-value-\u{00e9}-\u{1f512}";
  let replacement = "updated-test-value-\u{03bb}-\u{1f511}";
  let mut blob: Vec<u8> = original.encode_utf16().flat_map(u16::to_le_bytes).collect();
  let credential = CREDENTIALW {
    Type: CRED_TYPE_GENERIC,
    TargetName: target.as_mut_ptr(),
    UserName: user.as_mut_ptr(),
    CredentialBlobSize: blob.len() as u32,
    CredentialBlob: blob.as_mut_ptr(),
    Persist: CRED_PERSIST_ENTERPRISE,
    ..Default::default()
  };
  assert_ne!(unsafe { CredWriteW(&credential, 0) }, 0, "{}", std::io::Error::last_os_error());

  let vault = Keychain::new(&service);
  let previous = vault.get("legacy");
  let written = vault.put("legacy", replacement);
  let mut stored = std::ptr::null_mut();
  let read = unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut stored) };
  let updated = if read != 0 {
    let bytes = unsafe {
      std::slice::from_raw_parts((*stored).CredentialBlob, (*stored).CredentialBlobSize as usize)
        .to_vec()
    };
    unsafe { CredFree(stored.cast()) };
    Some(bytes)
  } else {
    None
  };
  vault.delete("legacy");
  let found = unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut stored) };
  let removed = found == 0 && unsafe { GetLastError() } == ERROR_NOT_FOUND;
  if found != 0 {
    unsafe { CredFree(stored.cast()) };
  }
  unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) };

  assert_eq!(previous.as_deref(), Some(original));
  assert!(written);
  let expected: Vec<u8> = replacement.encode_utf16().flat_map(u16::to_le_bytes).collect();
  assert_eq!(updated, Some(expected));
  assert!(removed);
}
