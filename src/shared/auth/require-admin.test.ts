import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const rpc = vi.fn()
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock('#/shared/api/supabase', () => ({
  getSupabase: () => ({
    auth: { getUser },
    rpc,
    from,
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  redirect: (opts: unknown) => {
    const err = new Error('REDIRECT') as Error & { options: unknown }
    err.options = opts
    return err
  },
}))

describe('requireAdmin / fetchIsAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated users to login', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { requireAdmin } = await import('./require-admin')
    await expect(
      requireAdmin({ location: { href: '/admin/members' } }),
    ).rejects.toMatchObject({
      options: {
        to: '/login',
        search: { redirect: '/admin/members' },
      },
    })
  })

  it('redirects non-admins to home account window', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
    rpc.mockResolvedValue({ data: false, error: null })
    const { requireAdmin } = await import('./require-admin')
    await expect(
      requireAdmin({ location: { href: '/admin' } }),
    ).rejects.toMatchObject({
      options: {
        to: '/',
        search: { open: 'account' },
      },
    })
  })

  it('returns admin user when RPC says admin', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
    rpc.mockResolvedValue({ data: true, error: null })
    const { requireAdmin } = await import('./require-admin')
    const result = await requireAdmin({ location: { href: '/admin' } })
    expect(result.profile.is_admin).toBe(true)
    expect(result.user.id).toBe('u1')
  })

  it('fetchIsAdmin falls back to profiles when RPC fails', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
    rpc.mockResolvedValue({ data: null, error: { message: 'missing' } })
    maybeSingle.mockResolvedValue({
      data: { is_admin: true },
      error: null,
    })
    const { fetchIsAdmin } = await import('./require-admin')
    await expect(fetchIsAdmin('u1')).resolves.toBe(true)
    await expect(fetchIsAdmin('other')).resolves.toBe(false)
  })
})
