/**
 * Vitest stub for vite-plugin-pwa virtual modules.
 */
import { vi } from 'vitest'

export function useRegisterSW() {
  return {
    needRefresh: [false, vi.fn()] as [boolean, (v: boolean) => void],
    offlineReady: [false, vi.fn()] as [boolean, (v: boolean) => void],
    updateServiceWorker: vi.fn(),
  }
}

export function registerSW() {
  return vi.fn()
}
