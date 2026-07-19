import { useState } from 'react'
import { usePwa } from '#/shared/pwa/PwaProvider'

const DISMISS_KEY = 'godebonner.offline.banner.dismissed'

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function OfflineBanner() {
  const { online } = usePwa()
  const [dismissed, setDismissed] = useState(readDismissed)

  if (online || dismissed) return null

  return (
    <div className="win95-offline-banner" role="status">
      <span className="win95-offline-banner__text">
        Ingen nettverk — kupongoppslag og meny krever tilkobling.
      </span>
      <button
        type="button"
        className="win95-offline-banner__close"
        aria-label="Lukk"
        onClick={() => {
          try {
            sessionStorage.setItem(DISMISS_KEY, '1')
          } catch {
            // ignore
          }
          setDismissed(true)
        }}
      >
        ×
      </button>
    </div>
  )
}
