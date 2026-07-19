import { hasSupabaseBrowserConfig, supabase } from '#/shared/api/supabase'

export type CheckStatus = 'pass' | 'fail'

export type HealthCheckResult = {
  id: string
  label: string
  status: CheckStatus
  detail?: string
  durationMs?: number
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const start = performance.now()
  const result = await fn()
  return { ms: Math.round(performance.now() - start), result }
}

export async function runHealthChecks(): Promise<{
  ranAt: string
  results: HealthCheckResult[]
}> {
  const ranAt = new Date().toISOString()
  const results: HealthCheckResult[] = []

  const envConfigured = hasSupabaseBrowserConfig
  results.push({
    id: 'supabase-env',
    label: 'Supabase configuration',
    status: envConfigured ? 'pass' : 'fail',
    detail: envConfigured
      ? 'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) are set'
      : 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY in environment',
  })

  if (!envConfigured) {
    return { ranAt, results }
  }

  const sb = supabase
  if (!sb) {
    results.push({
      id: 'supabase-client',
      label: 'Supabase client',
      status: 'fail',
      detail:
        'Client did not initialize (check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY)',
    })
    return { ranAt, results }
  }

  const sessionTimed = await timed(() => sb.auth.getSession())
  const session = sessionTimed.result.data.session
  results.push({
    id: 'supabase-session',
    label: 'Supabase session',
    status: session ? 'pass' : 'fail',
    detail: session ? `User id ${session.user.id}` : 'No active session',
    durationMs: sessionTimed.ms,
  })

  const userTimed = await timed(() => sb.auth.getUser())
  const authUser = userTimed.result.data.user
  const authErr = userTimed.result.error
  results.push({
    id: 'supabase-auth-user',
    label: 'Supabase JWT (getUser)',
    status: authUser && !authErr ? 'pass' : 'fail',
    detail: authErr?.message ?? (authUser ? `Validated as ${authUser.id}` : 'No user from server'),
    durationMs: userTimed.ms,
  })

  const rpcTimed = await timed(async () => sb.rpc('health_check'))
  const rpcData = rpcTimed.result.data as { ok?: boolean } | null
  const rpcErr = rpcTimed.result.error

  if (!rpcErr && rpcData?.ok === true) {
    results.push({
      id: 'supabase-db',
      label: 'Supabase database (health_check RPC)',
      status: 'pass',
      detail: 'RPC health_check returned ok',
      durationMs: rpcTimed.ms,
    })
  } else {
    const fallbackTimed = await timed(async () => {
      const uid = session?.user.id
      if (!uid) {
        return { ok: false as const, message: 'No session for profile check' }
      }
      const { data, error } = await sb
        .from('profiles')
        .select('id')
        .eq('id', uid)
        .maybeSingle()
      if (error) return { ok: false as const, message: error.message }
      if (data?.id) return { ok: true as const, message: undefined as string | undefined }
      return { ok: false as const, message: 'Profile row not found' }
    })
    const fb = fallbackTimed.result

    if (fb.ok) {
      results.push({
        id: 'supabase-db',
        label: 'Supabase database',
        status: 'pass',
        detail:
          rpcErr?.message != null
            ? `health_check RPC unavailable (${rpcErr.message}); profiles read succeeded`
            : 'profiles read succeeded',
        durationMs: rpcTimed.ms + fallbackTimed.ms,
      })
    } else {
      results.push({
        id: 'supabase-db',
        label: 'Supabase database',
        status: 'fail',
        detail: (() => {
          const rpcMsg = rpcErr?.message
          const fbMsg = fb.message
          if (rpcMsg && fbMsg) return `RPC: ${rpcMsg}; fallback: ${fbMsg}`
          if (rpcMsg) return `RPC: ${rpcMsg}`
          if (fbMsg) return fbMsg
          return 'Unknown database error'
        })(),
        durationMs: rpcTimed.ms + fallbackTimed.ms,
      })
    }
  }

  return { ranAt, results }
}
