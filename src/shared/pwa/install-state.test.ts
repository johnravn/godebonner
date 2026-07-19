import { describe, expect, it } from 'vitest'
import {
  detectIsIos,
  detectStandalone,
  resolveInstallSurface,
  shouldShowSoftInstallPrompt,
} from '#/shared/pwa/install-state'

describe('resolveInstallSurface', () => {
  it('hides when already installed', () => {
    expect(
      resolveInstallSurface({
        standalone: true,
        isIos: false,
        canPrompt: true,
        dismissal: null,
        visitCount: 5,
      }),
    ).toBe('already-installed')
  })

  it('hides when user chose never', () => {
    expect(
      resolveInstallSurface({
        standalone: false,
        isIos: true,
        canPrompt: false,
        dismissal: 'never',
        visitCount: 5,
      }),
    ).toBe('hidden')
  })

  it('prefers chromium prompt when available', () => {
    expect(
      resolveInstallSurface({
        standalone: false,
        isIos: false,
        canPrompt: true,
        dismissal: null,
        visitCount: 1,
      }),
    ).toBe('chromium-prompt')
  })

  it('shows ios instructions on iOS without prompt', () => {
    expect(
      resolveInstallSurface({
        standalone: false,
        isIos: true,
        canPrompt: false,
        dismissal: 'later',
        visitCount: 3,
      }),
    ).toBe('ios-instructions')
  })

  it('hides on unsupported desktop browsers', () => {
    expect(
      resolveInstallSurface({
        standalone: false,
        isIos: false,
        canPrompt: false,
        dismissal: null,
        visitCount: 3,
      }),
    ).toBe('hidden')
  })
})

describe('shouldShowSoftInstallPrompt', () => {
  it('requires a logged-in user', () => {
    expect(
      shouldShowSoftInstallPrompt({
        standalone: false,
        isIos: false,
        canPrompt: true,
        dismissal: null,
        visitCount: 2,
        isAuthenticated: false,
      }),
    ).toBe(false)
  })

  it('requires at least two visits', () => {
    expect(
      shouldShowSoftInstallPrompt({
        standalone: false,
        isIos: false,
        canPrompt: true,
        dismissal: null,
        visitCount: 1,
        isAuthenticated: true,
      }),
    ).toBe(false)

    expect(
      shouldShowSoftInstallPrompt({
        standalone: false,
        isIos: false,
        canPrompt: true,
        dismissal: null,
        visitCount: 2,
        isAuthenticated: true,
      }),
    ).toBe(true)

    expect(
      shouldShowSoftInstallPrompt({
        standalone: false,
        isIos: false,
        canPrompt: true,
        dismissal: 'later',
        visitCount: 5,
        isAuthenticated: true,
      }),
    ).toBe(false)
  })
})

describe('detect helpers', () => {
  it('detects iOS user agents', () => {
    expect(detectIsIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(
      true,
    )
    expect(detectIsIos('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false)
  })

  it('detects standalone via media or navigator', () => {
    expect(
      detectStandalone({
        displayModeStandalone: true,
        navigatorStandalone: false,
      }),
    ).toBe(true)
    expect(
      detectStandalone({
        displayModeStandalone: false,
        navigatorStandalone: true,
      }),
    ).toBe(true)
    expect(
      detectStandalone({
        displayModeStandalone: false,
        navigatorStandalone: false,
      }),
    ).toBe(false)
  })
})
