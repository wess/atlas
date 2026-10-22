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
