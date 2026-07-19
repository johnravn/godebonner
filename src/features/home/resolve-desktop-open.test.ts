import { describe, expect, it } from 'vitest'
import { resolveDesktopOpen } from './resolve-desktop-open'

describe('resolveDesktopOpen', () => {
  it('returns undefined for missing or unknown keys', () => {
    expect(resolveDesktopOpen()).toBeUndefined()
    expect(resolveDesktopOpen('')).toBeUndefined()
    expect(resolveDesktopOpen('nope')).toBeUndefined()
  })

  it('resolves public window aliases', () => {
    expect(resolveDesktopOpen('coupons')).toBe('coupons')
    expect(resolveDesktopOpen('account')).toBe('login')
    expect(resolveDesktopOpen('login')).toBe('login')
    expect(resolveDesktopOpen('meny')).toBe('meny')
    expect(resolveDesktopOpen('recycle')).toBe('recycle')
    expect(resolveDesktopOpen('minesweeper')).toBe('minesweeper')
    expect(resolveDesktopOpen('solitaire')).toBe('solitaire')
  })

  it('resolves admin window aliases', () => {
    expect(resolveDesktopOpen('admin')).toBe('admin-panel')
    expect(resolveDesktopOpen('panel')).toBe('admin-panel')
    expect(resolveDesktopOpen('members')).toBe('admin-members')
    expect(resolveDesktopOpen('register')).toBe('admin-register')
    expect(resolveDesktopOpen('organization')).toBe('admin-organization')
    expect(resolveDesktopOpen('org')).toBe('admin-organization')
    expect(resolveDesktopOpen('papirkurv')).toBe('admin-papirkurv')
    expect(resolveDesktopOpen('users')).toBe('admin-users')
    expect(resolveDesktopOpen('status')).toBe('admin-status')
    expect(resolveDesktopOpen('welcome')).toBe('admin-welcome')
    expect(resolveDesktopOpen('admin-meny')).toBe('admin-meny')
  })
})
