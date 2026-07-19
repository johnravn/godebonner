import { useEffect, useState } from 'react'

/**
 * Only treat an explicit `false` as offline.
 * Node (SSR) exposes `navigator` but `navigator.onLine` is `undefined` — that
 * must not flash the offline banner.
 */
export function readOnlineStatus(
  nav: { onLine?: boolean } | null | undefined,
): boolean {
  return nav?.onLine !== false
}

export function useOnlineStatus(): boolean {
  // Optimistic default — never trust SSR/Node navigator.onLine.
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const sync = () => setOnline(readOnlineStatus(navigator))
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  return online
}
