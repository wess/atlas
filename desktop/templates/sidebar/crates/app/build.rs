//! Stamps `BUILD_DATE` and `BUILD_KIND` into the binary for the About card.
//! The release workflow sets `__APPENV___RELEASE=1`; nothing else does, so
//! every other build says what it is.

fn main() {
    atlasbuild::stamp("__APPENV__");
}
