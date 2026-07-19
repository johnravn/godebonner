import { describe, expect, it } from 'vitest'
import { normalizeMemberPhone } from './phone'

describe('normalizeMemberPhone', () => {
  it('returns null for empty or whitespace', () => {
    expect(normalizeMemberPhone('')).toBeNull()
    expect(normalizeMemberPhone('   ')).toBeNull()
  })

  it('keeps 8-digit Norwegian mobiles', () => {
    expect(normalizeMemberPhone('91234567')).toBe('91234567')
  })

  it('strips punctuation and spaces', () => {
    expect(normalizeMemberPhone('912 34 567')).toBe('91234567')
    expect(normalizeMemberPhone('+47 912 34 567')).toBe('91234567')
    expect(normalizeMemberPhone('(912) 34-567')).toBe('91234567')
  })

  it('strips leading country code 47 from 10-digit numbers', () => {
    expect(normalizeMemberPhone('4791234567')).toBe('91234567')
  })

  it('strips leading 047 from 11-digit numbers', () => {
    expect(normalizeMemberPhone('04791234567')).toBe('91234567')
  })

  it('returns digit string as-is for other lengths', () => {
    expect(normalizeMemberPhone('123')).toBe('123')
    expect(normalizeMemberPhone('123456789012')).toBe('123456789012')
  })
})
