import { type MouseEvent, useSyncExternalStore } from "react"

// pushState fires no event of its own, so navigate has to tell subscribers itself
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener("popstate", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("popstate", listener)
  }
}

export const usePathname = () => useSyncExternalStore(subscribe, () => window.location.pathname)

export const navigate = (to: string, options: { replace?: boolean } = {}) => {
  if (to === window.location.pathname) return
  window.history[options.replace ? "replaceState" : "pushState"](null, "", to)
  for (const listener of listeners) listener()
}

// leave modified clicks to the browser so a link can still open in a new tab
export const follow = (to: string) => (event: MouseEvent) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  navigate(to)
}
