import { describe, expect, it } from 'vitest'
import {
  isCustomIconValue,
  parseCustomIconPath,
  toCustomIconValue,
} from './custom-icon'

describe('custom-icon helpers', () => {
  it('detects custom icon values', () => {
    expect(isCustomIconValue('custom:foo/bar.png')).toBe(true)
    expect(isCustomIconValue('custom:')).toBe(false)
    expect(isCustomIconValue('foo/bar.png')).toBe(false)
  })

  it('parses storage path from custom value', () => {
    expect(parseCustomIconPath('custom:icons/a.png')).toBe('icons/a.png')
    expect(parseCustomIconPath('icons/a.png')).toBeNull()
  })

  it('builds custom values and strips leading slashes', () => {
    expect(toCustomIconValue('icons/a.png')).toBe('custom:icons/a.png')
    expect(toCustomIconValue('/icons/a.png')).toBe('custom:icons/a.png')
    expect(toCustomIconValue('///icons/a.png')).toBe('custom:icons/a.png')
  })

  it('round-trips path encoding', () => {
    const value = toCustomIconValue('user/abc.png')
    expect(parseCustomIconPath(value)).toBe('user/abc.png')
  })
})
