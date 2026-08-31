//! The bottom of an Atlas Desktop app: types with no dependencies worth
//! arguing about, and no gpui.
//!
//! Everything here was written three times in three apps before it moved. The
//! test is not "could this be shared" but "was it already copied" — [`Load`]
//! was, the byte formatter was, and the id/timestamp pair was.

mod format;
mod id;
mod load;

pub use format::{ago, bytes, count, duration, truncate};
pub use id::{iso_now, uuid};
pub use load::Load;
