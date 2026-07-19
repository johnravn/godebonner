export type InstallDismissal = 'never' | 'later' | null

export type InstallSurface =
  | 'hidden'
  | 'chromium-prompt'
  | 'ios-instructions'
  | 'already-installed'

export type InstallEnvironment = {
  standalone: boolean
  isIos: boolean
  canPrompt: boolean
  dismissal: InstallDismissal
  visitCount: number
}

export const PWA_INSTALL_DISMISS_KEY = 'godebonner.pwa.install.dismiss'
export const PWA_INSTALL_VISIT_KEY = 'godebonner.pwa.install.visits'

/** Pure install-state resolver for Start menu / soft prompt visibility. */
export function resolveInstallSurface(env: InstallEnvironment): InstallSurface {
  if (env.standalone) return 'already-installed'
  if (env.dismissal === 'never') return 'hidden'
  if (env.canPrompt) return 'chromium-prompt'
  if (env.isIos) return 'ios-instructions'
  return 'hidden'
}

/** Soft prompt after 2nd visit for logged-in users unless dismissed or already installed. */
export function shouldShowSoftInstallPrompt(
  env: InstallEnvironment & { isAuthenticated: boolean },
): boolean {
  if (!env.isAuthenticated) return false
  if (env.standalone) return false
  if (env.dismissal !== null) return false
  if (env.visitCount < 2) return false
  const surface = resolveInstallSurface(env)
  return surface === 'chromium-prompt' || surface === 'ios-instructions'
}

export function detectIsIos(userAgent: string): boolean {
  return /iPad|iPhone|iPod/i.test(userAgent)
}

export function detectStandalone(opts: {
  displayModeStandalone: boolean
  navigatorStandalone?: boolean
}): boolean {
  return opts.displayModeStandalone || opts.navigatorStandalone === true
}
