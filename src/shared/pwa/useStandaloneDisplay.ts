import { useEffect, useState } from 'react'
import { detectStandalone } from '#/shared/pwa/install-state'

export function useStandaloneDisplay(): boolean {
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const update = () => {
      setStandalone(
        detectStandalone({
          displayModeStandalone: media.matches,
          navigatorStandalone: window.navigator.standalone,
        }),
      )
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return standalone
}
