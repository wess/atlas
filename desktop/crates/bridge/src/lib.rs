//! The tokio ↔ gpui bridge.
//!
//! Almost everything an app talks to — a database driver, an HTTP client, a
//! child process — runs on a tokio runtime. gpui has its own executor and its
//! own main thread. This is the single seam between them:
//!
//! ```no_run
//! # use gpui::App;
//! # async fn fetch() -> Vec<String> { vec![] }
//! # fn example(cx: &mut App) {
//! atlasbridge::run(cx, fetch(), |rows, cx| {
//!     // back on the gpui main thread, with the result in hand
//!     let _ = (rows, cx);
//! });
//! # }
//! ```
//!
//! Keeping it to one seam is the point. Every async call in the app crosses
//! here, so there is one place to look when a result never arrives and one
//! runtime to reason about — not a `Runtime::new()` per module and four
//! thread pools competing for the same cores.
//!
//! The handoff is a `futures` oneshot rather than a tokio one, because the
//! receiving half is awaited on gpui's executor, which is not a tokio context.

use std::future::Future;
use std::sync::OnceLock;

use futures::channel::mpsc;
use futures::StreamExt;
use gpui::App;
use tokio::runtime::Runtime;

/// The process-wide tokio runtime, created on first use.
pub fn runtime() -> &'static Runtime {
    static RT: OnceLock<Runtime> = OnceLock::new();
    RT.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("build tokio runtime")
    })
}

/// Run `fut` on the tokio runtime, then `done` on the gpui main thread.
///
/// If the window is gone by the time the future finishes, `done` is never
/// called — which is what you want: there is nothing left to update.
pub fn run<T: Send + 'static>(
    cx: &mut App,
    fut: impl Future<Output = T> + Send + 'static,
    done: impl FnOnce(T, &mut App) + 'static,
) {
    let (tx, rx) = futures::channel::oneshot::channel();
    runtime().spawn(async move {
        let _ = tx.send(fut.await);
    });
    cx.spawn(async move |cx| {
        if let Ok(result) = rx.await {
            let _ = cx.update(|cx| done(result, cx));
        }
    })
    .detach();
}

/// Run `fut` on the tokio runtime and discard the result. For a call made for
/// its effect, where nothing on screen depends on the answer.
pub fn spawn(fut: impl Future<Output = ()> + Send + 'static) {
    runtime().spawn(fut);
}

/// Run a streaming producer on the tokio runtime, delivering each item to
/// `on_item` on the gpui main thread as it arrives, then `on_done` when the
/// producer finishes.
///
/// The producer is handed the sender. When the receiving side goes away the
/// sender's `send` starts failing, which is how a closed view cancels a log or
/// token stream — there is no separate abort registry to keep in sync.
pub fn stream<T, Fut>(
    cx: &mut App,
    producer: impl FnOnce(mpsc::UnboundedSender<T>) -> Fut + Send + 'static,
    mut on_item: impl FnMut(T, &mut App) + 'static,
    on_done: impl FnOnce(&mut App) + 'static,
) where
    T: Send + 'static,
    Fut: Future<Output = ()> + Send + 'static,
{
    let (tx, mut rx) = mpsc::unbounded();
    runtime().spawn(producer(tx));
    cx.spawn(async move |cx| {
        while let Some(item) = rx.next().await {
            if cx.update(|cx| on_item(item, cx)).is_err() {
                return;
            }
        }
        let _ = cx.update(|cx| on_done(cx));
    })
    .detach();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_runtime_is_created_once_and_shared() {
        // Two `Runtime::new()` calls would mean two thread pools; the whole
        // point of the bridge is that there is one.
        assert!(std::ptr::eq(runtime(), runtime()));
    }

    #[test]
    fn work_actually_runs_on_it() {
        let (tx, rx) = std::sync::mpsc::channel();
        spawn(async move {
            let _ = tx.send(21 * 2);
        });
        assert_eq!(rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap(), 42);
    }
}
