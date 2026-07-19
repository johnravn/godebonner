import { describe, expect, it } from 'vitest'
import { readOnlineStatus } from '#/shared/pwa/useOnlineStatus'

describe('readOnlineStatus', () => {
  it('treats missing navigator as online', () => {
    expect(readOnlineStatus(undefined)).toBe(true)
    expect(readOnlineStatus(null)).toBe(true)
  })

  it('treats Node-like navigator (onLine undefined) as online', () => {
    expect(readOnlineStatus({})).toBe(true)
    expect(readOnlineStatus({ onLine: undefined })).toBe(true)
  })

  it('only reports offline for explicit false', () => {
    expect(readOnlineStatus({ onLine: false })).toBe(false)
    expect(readOnlineStatus({ onLine: true })).toBe(true)
  })
})
