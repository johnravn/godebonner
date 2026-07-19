import { useEffect } from 'react'
import { detectIsIos } from '#/shared/pwa/install-state'

/**
 * iOS standalone PWAs often launch with a layout viewport shorter than the
 * physical screen. `position: fixed; bottom: 0` then sits above the home
 * indicator and the body background (desktop teal) shows through until the
 * first orientation/resize recalculates insets.
 *
 * Sets `win95-pwa-standalone` for CSS (older iOS may lack display-mode media)
 * and nudges layout so safe-area / fixed bottom catch up without a rotate.
 */
export function useIosStandaloneViewportFix(standalone: boolean) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('win95-pwa-standalone', standalone)

    if (!standalone) return

    const isIos =
      detectIsIos(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    if (!isIos) {
      return () => {
        root.classList.remove('win95-pwa-standalone')
      }
    }

    const kick = () => {
      // Reading visualViewport + a trivial scroll forces WebKit to recompute
      // the layout viewport the same way an orientation change does.
      void window.visualViewport?.height
      window.scrollTo(0, 0)
    }

    kick()

    const vv = window.visualViewport
    vv?.addEventListener('resize', kick)
    window.addEventListener('orientationchange', kick)
    window.addEventListener('pageshow', kick)

    const timers = [0, 50, 250, 1000].map((ms) => window.setTimeout(kick, ms))
    const raf = requestAnimationFrame(() => {
      kick()
      requestAnimationFrame(kick)
    })

    return () => {
      vv?.removeEventListener('resize', kick)
      window.removeEventListener('orientationchange', kick)
      window.removeEventListener('pageshow', kick)
      for (const id of timers) window.clearTimeout(id)
      cancelAnimationFrame(raf)
      root.classList.remove('win95-pwa-standalone')
    }
  }, [standalone])
}
