import { describe, expect, it } from 'vitest'
import { postAuthRedirectTarget } from './redirect-after-login'

describe('postAuthRedirectTarget', () => {
  it('defaults to / when redirect is missing or invalid', () => {
    expect(postAuthRedirectTarget(undefined, false)).toBe('/')
    expect(postAuthRedirectTarget('', true)).toBe('/')
    expect(postAuthRedirectTarget('https://evil.example', false)).toBe('/')
    expect(postAuthRedirectTarget('admin', false)).toBe('/')
  })

  it('blocks admin, account, and login paths', () => {
    expect(postAuthRedirectTarget('/admin', true)).toBe('/')
    expect(postAuthRedirectTarget('/admin/members', true)).toBe('/')
    expect(postAuthRedirectTarget('/account', false)).toBe('/')
    expect(postAuthRedirectTarget('/login', false)).toBe('/')
    expect(postAuthRedirectTarget('/login?x=1', false)).toBe('/')
  })

  it('allows safe relative paths (query stripped to path only)', () => {
    expect(postAuthRedirectTarget('/?open=coupons', false)).toBe('/')
    expect(postAuthRedirectTarget('/foo', false)).toBe('/foo')
    expect(postAuthRedirectTarget('/foo?bar=1', false)).toBe('/foo')
  })
})
