use std::sync::{Arc, LazyLock};

use keyring_core::{CredentialStore, Entry, Error, Result};

static STORE: LazyLock<Result<Arc<CredentialStore>>> = LazyLock::new(open);

#[cfg(target_os = "macos")]
fn open() -> Result<Arc<CredentialStore>> {
  Ok(apple_native_keyring_store::keychain::Store::new()?)
}

#[cfg(target_os = "linux")]
fn open() -> Result<Arc<CredentialStore>> {
  Ok(linux_keyutils_keyring_store::Store::new()?)
}

#[cfg(target_os = "windows")]
fn open() -> Result<Arc<CredentialStore>> {
  Ok(windows_native_keyring_store::Store::new()?)
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn open() -> Result<Arc<CredentialStore>> {
  Err(Error::NoDefaultStore)
}

pub(super) fn entry(service: &str, key: &str) -> Result<Entry> {
  let store = STORE.as_ref().map_err(|_| Error::NoDefaultStore)?;
  #[cfg(target_os = "linux")]
  {
    // keep the v3 kernel-key identity; the new provider defaults to another format
    let description = format!("keyring-rs:{key}@{service}");
    let modifiers = std::collections::HashMap::from([("description", description.as_str())]);
    store.build(service, key, Some(&modifiers))
  }
  #[cfg(not(target_os = "linux"))]
  store.build(service, key, None)
}
