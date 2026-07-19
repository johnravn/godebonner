import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '#/app/providers/AuthProvider'
import {
  detectIsIos,
  PWA_INSTALL_DISMISS_KEY,
  PWA_INSTALL_VISIT_KEY,
  resolveInstallSurface,
  shouldShowSoftInstallPrompt,
} from '#/shared/pwa/install-state'
import type {
  InstallDismissal,
  InstallSurface,
} from '#/shared/pwa/install-state'
import { useOnlineStatus } from '#/shared/pwa/useOnlineStatus'
import { useStandaloneDisplay } from '#/shared/pwa/useStandaloneDisplay'

type PwaContextValue = {
  online: boolean
  standalone: boolean
  installSurface: InstallSurface
  canInstallFromMenu: boolean
  softInstallOpen: boolean
  updateAvailable: boolean
  openInstallDialog: () => void
  closeSoftInstall: () => void
  dismissInstallForever: () => void
  dismissInstallLater: () => void
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  applyUpdate: () => void
  dismissUpdate: () => void
}

const PwaContext = createContext<PwaContextValue | null>(null)

function readDismissal(): InstallDismissal {
  try {
    const raw = localStorage.getItem(PWA_INSTALL_DISMISS_KEY)
    if (raw === 'never' || raw === 'later') return raw
  } catch {
    // ignore
  }
  return null
}

function bumpVisitCount(): number {
  try {
    const next = Number(localStorage.getItem(PWA_INSTALL_VISIT_KEY) || '0') + 1
    localStorage.setItem(PWA_INSTALL_VISIT_KEY, String(next))
    return next
  } catch {
    return 1
  }
}

function useServiceWorkerUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateSW, setUpdateSW] = useState<
    ((reloadPage?: boolean) => Promise<void>) | null
  >(null)

  useEffect(() => {
    let cancelled = false
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return
      const update = registerSW({
        immediate: true,
        onNeedRefresh() {
          if (!cancelled) setNeedRefresh(true)
        },
      })
      setUpdateSW(() => update)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return {
    needRefresh,
    updateServiceWorker: (reload?: boolean) => {
      void updateSW?.(reload)
    },
  }
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const online = useOnlineStatus()
  const standalone = useStandaloneDisplay()
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [dismissal, setDismissal] = useState<InstallDismissal>(null)
  const [visitCount, setVisitCount] = useState(0)
  const [installDialogForced, setInstallDialogForced] = useState(false)
  const [softDismissedThisSession, setSoftDismissedThisSession] = useState(false)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const { needRefresh, updateServiceWorker } = useServiceWorkerUpdate()
  const isAuthenticated = !authLoading && !!user

  useEffect(() => {
    setDismissal(readDismissal())
    setVisitCount(bumpVisitCount())
  }, [])

  useEffect(() => {
    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () =>
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const isIos = useMemo(
    () =>
      typeof navigator !== 'undefined'
        ? detectIsIos(navigator.userAgent)
        : false,
    [],
  )

  const installSurface = useMemo(
    () =>
      resolveInstallSurface({
        standalone,
        isIos,
        canPrompt: !!deferredPrompt,
        dismissal,
        visitCount,
      }),
    [standalone, isIos, deferredPrompt, dismissal, visitCount],
  )

  const softInstallOpen =
    !softDismissedThisSession &&
    (installDialogForced ||
      shouldShowSoftInstallPrompt({
        standalone,
        isIos,
        canPrompt: !!deferredPrompt,
        dismissal,
        visitCount,
        isAuthenticated,
      }))

  const canInstallFromMenu =
    !standalone &&
    (installSurface === 'chromium-prompt' ||
      installSurface === 'ios-instructions' ||
      isIos)

  const openInstallDialog = useCallback(() => {
    setInstallDialogForced(true)
    setSoftDismissedThisSession(false)
  }, [])

  const closeSoftInstall = useCallback(() => {
    setInstallDialogForced(false)
    setSoftDismissedThisSession(true)
  }, [])

  const dismissInstallForever = useCallback(() => {
    try {
      localStorage.setItem(PWA_INSTALL_DISMISS_KEY, 'never')
    } catch {
      // ignore
    }
    setDismissal('never')
    setInstallDialogForced(false)
    setSoftDismissedThisSession(true)
  }, [])

  const dismissInstallLater = useCallback(() => {
    try {
      localStorage.setItem(PWA_INSTALL_DISMISS_KEY, 'later')
    } catch {
      // ignore
    }
    setDismissal('later')
    setInstallDialogForced(false)
    setSoftDismissedThisSession(true)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setInstallDialogForced(false)
    setSoftDismissedThisSession(true)
    return outcome
  }, [deferredPrompt])

  const applyUpdate = useCallback(() => {
    updateServiceWorker(true)
  }, [updateServiceWorker])

  const dismissUpdate = useCallback(() => {
    setUpdateDismissed(true)
  }, [])

  const value = useMemo<PwaContextValue>(
    () => ({
      online,
      standalone,
      installSurface,
      canInstallFromMenu,
      softInstallOpen,
      updateAvailable: needRefresh && !updateDismissed,
      openInstallDialog,
      closeSoftInstall,
      dismissInstallForever,
      dismissInstallLater,
      promptInstall,
      applyUpdate,
      dismissUpdate,
    }),
    [
      online,
      standalone,
      installSurface,
      canInstallFromMenu,
      softInstallOpen,
      needRefresh,
      updateDismissed,
      openInstallDialog,
      closeSoftInstall,
      dismissInstallForever,
      dismissInstallLater,
      promptInstall,
      applyUpdate,
      dismissUpdate,
    ],
  )

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>
}

export function usePwa(): PwaContextValue {
  const ctx = useContext(PwaContext)
  if (!ctx) {
    throw new Error('usePwa must be used within PwaProvider')
  }
  return ctx
}
