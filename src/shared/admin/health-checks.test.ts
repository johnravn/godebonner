import { afterEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
const getUser = vi.fn()
const rpc = vi.fn()
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock('#/shared/api/supabase', () => ({
  hasSupabaseBrowserConfig: true,
  supabase: {
    auth: { getSession, getUser },
    rpc,
    from,
  },
}))

describe('runHealthChecks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('reports pass when session, user, and health_check RPC succeed', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })
    getUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
    rpc.mockResolvedValue({ data: { ok: true }, error: null })

    const { runHealthChecks } = await import('./health-checks')
    const { results } = await runHealthChecks()
    expect(results.find((r) => r.id === 'supabase-env')?.status).toBe('pass')
    expect(results.find((r) => r.id === 'supabase-session')?.status).toBe(
      'pass',
    )
    expect(results.find((r) => r.id === 'supabase-db')?.status).toBe('pass')
    expect(results.find((r) => r.id === 'external-apis')?.status).toBe('skip')
  })

  it('falls back to profiles when health_check RPC fails', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })
    getUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
    rpc.mockResolvedValue({ data: null, error: { message: 'no fn' } })
    maybeSingle.mockResolvedValue({ data: { id: 'u1' }, error: null })

    const { runHealthChecks } = await import('./health-checks')
    const { results } = await runHealthChecks()
    const db = results.find((r) => r.id === 'supabase-db')
    expect(db?.status).toBe('pass')
    expect(db?.detail).toMatch(/profiles/i)
  })

  it('pings configured external URLs', async () => {
    vi.stubEnv('VITE_ADMIN_STATUS_URLS', 'https://example.com/health')
    getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })
    getUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
    rpc.mockResolvedValue({ data: { ok: true }, error: null })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' }),
    )

    const { runHealthChecks } = await import('./health-checks')
    const { results } = await runHealthChecks()
    expect(results.find((r) => r.id === 'external-0')?.status).toBe('pass')
  })
})
