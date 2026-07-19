import { Button, Fieldset, Frame } from '@react95/core'
import { FileSettings } from '@react95/icons'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  hasSupabaseBrowserConfig,
  readSupabaseClientKeyFromEnv,
  supabase,
} from '#/shared/api/supabase'

type ConnectionProbe = {
  url: string
  host: string
  target: 'local' | 'remote' | 'unknown'
  keyConfigured: boolean
  keyPreview: string
  authOk: boolean
  dbOk: boolean
  detail: string
  durationMs: number
}

function maskKey(key: string): string {
  if (!key) return '(missing)'
  if (key.length <= 12) return `${key.slice(0, 4)}…`
  return `${key.slice(0, 10)}…${key.slice(-4)}`
}

function classifyTarget(hostname: string): ConnectionProbe['target'] {
  if (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '::1'
  ) {
    return 'local'
  }
  if (hostname.endsWith('.supabase.co')) return 'remote'
  return 'unknown'
}

async function probeConnection(): Promise<ConnectionProbe> {
  const start = performance.now()
  const rawUrl =
    typeof import.meta.env.VITE_SUPABASE_URL === 'string'
      ? import.meta.env.VITE_SUPABASE_URL.trim()
      : ''
  const key = readSupabaseClientKeyFromEnv()

  let host = ''
  let target: ConnectionProbe['target'] = 'unknown'
  try {
    const parsed = new URL(rawUrl)
    host = parsed.hostname
    target = classifyTarget(host)
  } catch {
    host = rawUrl || '(invalid URL)'
  }

  const base: Omit<ConnectionProbe, 'authOk' | 'dbOk' | 'detail' | 'durationMs'> =
    {
      url: rawUrl || '(not set)',
      host,
      target,
      keyConfigured: Boolean(key),
      keyPreview: maskKey(key),
    }

  if (!hasSupabaseBrowserConfig || !supabase) {
    return {
      ...base,
      authOk: false,
      dbOk: false,
      detail:
        'Supabase env is incomplete. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.',
      durationMs: Math.round(performance.now() - start),
    }
  }

  let authOk = false
  let authDetail = ''
  try {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${rawUrl.replace(/\/$/, '')}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    })
    clearTimeout(timeout)
    authOk = res.ok
    authDetail = res.ok
      ? `Auth health HTTP ${res.status}`
      : `Auth health HTTP ${res.status} ${res.statusText}`.trim()
  } catch (e) {
    authDetail =
      e instanceof Error && e.name === 'AbortError'
        ? 'Auth health timed out (8s)'
        : e instanceof Error
          ? e.message
          : 'Auth health request failed'
  }

  let dbOk = false
  let dbDetail = ''
  const rpc = await supabase.rpc('health_check')
  if (!rpc.error && (rpc.data as { ok?: boolean } | null)?.ok === true) {
    dbOk = true
    dbDetail = 'health_check RPC ok'
  } else {
    // Lightweight anonymous-safe probe: ask PostgREST for OpenAPI root via a tiny select.
    // Prefer profiles count limit 0 so we don't need rows — RLS may still allow/deny.
    const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' }).limit(0)
    if (!error) {
      dbOk = true
      dbDetail =
        rpc.error != null
          ? `health_check unavailable (${rpc.error.message}); profiles reachable`
          : 'profiles reachable'
    } else {
      dbDetail =
        rpc.error != null
          ? `RPC: ${rpc.error.message}; profiles: ${error.message}`
          : error.message
    }
  }

  const parts = [authDetail, dbDetail].filter(Boolean)
  return {
    ...base,
    authOk,
    dbOk,
    detail: parts.join(' · '),
    durationMs: Math.round(performance.now() - start),
  }
}

function statusBadge(ok: boolean | null) {
  if (ok === null) {
    return <span className="win95-badge win95-badge--muted">…</span>
  }
  if (ok) {
    return <span className="win95-badge win95-badge--pass">OK</span>
  }
  return <span className="win95-badge win95-badge--fail">Fail</span>
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Frame
      display="flex"
      justifyContent="space-between"
      alignItems="flex-start"
      gap="$2"
      style={{ fontSize: 13 }}
    >
      <span className="win95-muted" style={{ flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ textAlign: 'right', wordBreak: 'break-word', minWidth: 0 }}>
        {children}
      </span>
    </Frame>
  )
}

export function DevToolsWindow() {
  const { data, isFetching, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['devtools', 'supabase-connection'],
    queryFn: probeConnection,
    refetchOnWindowFocus: false,
  })

  const overallOk = data ? data.authOk && data.dbOk : null
  const updatedLabel =
    dataUpdatedAt > 0
      ? new Intl.DateTimeFormat(undefined, {
          timeStyle: 'medium',
        }).format(new Date(dataUpdatedAt))
      : null

  return (
    <>
      <Frame display="flex" alignItems="center" gap="$3">
        <FileSettings width={32} height={32} variant="32x32_4" />
        <div>
          <strong style={{ fontSize: 14 }}>DevTools</strong>
          <p className="win95-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
            Development-only diagnostics. More panels can be added here later.
          </p>
        </div>
      </Frame>

      <Fieldset legend="Database" p="$2" style={{ width: '100%', boxSizing: 'border-box' }}>
        <Frame display="flex" flexDirection="column" gap="$2">
          <Frame display="flex" alignItems="center" justifyContent="space-between" gap="$2">
            <Frame display="flex" alignItems="center" gap="$2">
              <strong style={{ fontSize: 13 }}>Connection</strong>
              {statusBadge(overallOk)}
            </Frame>
            <Button onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? 'Checking…' : 'Refresh'}
            </Button>
          </Frame>

          {isError ? (
            <p style={{ margin: 0, fontSize: 13, color: '#800000' }}>
              {error instanceof Error ? error.message : 'Probe failed'}
            </p>
          ) : null}

          {data ? (
            <>
              <Row label="URL">{data.url}</Row>
              <Row label="Host">{data.host}</Row>
              <Row label="Target">{data.target}</Row>
              <Row label="API key">{data.keyPreview}</Row>
              <Row label="Auth">{statusBadge(data.authOk)}</Row>
              <Row label="Database">{statusBadge(data.dbOk)}</Row>
              <Row label="Detail">
                <span className="win95-muted">{data.detail}</span>
              </Row>
              <Row label="Latency">{data.durationMs} ms</Row>
            </>
          ) : (
            <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
              {isFetching ? 'Probing Supabase…' : 'No data yet.'}
            </p>
          )}

          {updatedLabel ? (
            <p className="win95-muted" style={{ margin: '4px 0 0', fontSize: 11 }}>
              Last check: {updatedLabel}
            </p>
          ) : null}
        </Frame>
      </Fieldset>

      <Fieldset
        legend="More"
        p="$2"
        style={{ width: '100%', boxSizing: 'border-box', marginTop: 'auto' }}
      >
        <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
          Placeholder for future tools (session dump, feature flags, RPC playground,
          …).
        </p>
      </Fieldset>
    </>
  )
}
