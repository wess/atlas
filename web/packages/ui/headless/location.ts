import { useSyncExternalStore } from "react";

// pushState fires no event of its own, so navigate has to tell subscribers itself
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
};

const current = () => `${window.location.pathname}${window.location.search}`;

export const useLocation = () => {
  const href = useSyncExternalStore(subscribe, current, () => "/");
  const at = href.indexOf("?");
  return at < 0 ? { pathname: href, search: "" } : { pathname: href.slice(0, at), search: href.slice(at) };
};

export const navigate = (to: string, options: { replace?: boolean } = {}) => {
  if (to === current()) return;
  window.history[options.replace ? "replaceState" : "pushState"](null, "", to);
  if (!options.replace) window.scrollTo(0, 0);
  for (const listener of listeners) listener();
};

// a real link should still open in a new tab or window when the browser was asked to
export const isPlainClick = (event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
