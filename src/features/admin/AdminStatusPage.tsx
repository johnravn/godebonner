import { Button, Frame } from '@react95/core'
import { useCallback, useState } from 'react'
import type { HealthCheckResult } from '#/shared/admin/health-checks'
import { runHealthChecks } from '#/shared/admin/health-checks'
import { Win95InlineAlert } from '#/shared/ui/Win95InlineAlert'

function statusBadge(status: HealthCheckResult['status']) {
  if (status === 'pass') {
    return <span className="win95-badge win95-badge--pass">Pass</span>
  }
  return <span className="win95-badge win95-badge--fail">Fail</span>
}

export function AdminStatusPage() {
  const [loading, setLoading] = useState(false)
  const [ranAt, setRanAt] = useState<string | null>(null)
  const [results, setResults] = useState<HealthCheckResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const out = await runHealthChecks()
      setRanAt(out.ranAt)
      setResults(out.results)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checks failed unexpectedly')
    } finally {
      setLoading(false)
    }
  }, [])

  const hasFailure = results.some((r) => r.status === 'fail')
  const formattedTime =
    ranAt != null
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'medium',
        }).format(new Date(ranAt))
      : null

  return (
    <Frame display="flex" flexDirection="column" gap="$12">
      <Frame display="flex" flexDirection="column" gap="$4">
        <h2 style={{ margin: 0, fontSize: 18 }}>System status</h2>
        <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
          Read-only checks for Supabase connectivity. Results stay in this
          browser session until you run checks again.
        </p>
      </Frame>

      <Frame display="flex" flexWrap="wrap" alignItems="center" gap="$8">
        <Button onClick={() => void execute()} disabled={loading}>
          {loading ? 'Running…' : 'Run checks'}
        </Button>
        {formattedTime != null ? (
          <span className="win95-muted" style={{ fontSize: 13 }}>
            Last run: {formattedTime}
          </span>
        ) : null}
      </Frame>

      {error != null ? (
        <Win95InlineAlert title="Error">{error}</Win95InlineAlert>
      ) : null}

      {hasFailure && results.length > 0 ? (
        <Win95InlineAlert title="Some checks failed">
          Review the items below. For database RPC errors, apply the latest
          migrations (see README) or use the SQL documented there.
        </Win95InlineAlert>
      ) : null}

      <Frame display="flex" flexDirection="column" gap="$8">
        {results.map((row) => (
          <Frame key={row.id} boxShadow="$out" p="$6">
            <Frame
              display="flex"
              justifyContent="space-between"
              alignItems="flex-start"
              gap="$8"
            >
              <strong style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                {row.label}
              </strong>
              {statusBadge(row.status)}
            </Frame>
            {row.detail != null ? (
              <p
                className="win95-muted"
                style={{
                  margin: '8px 0 0',
                  fontSize: 13,
                  wordBreak: 'break-word',
                }}
              >
                {row.detail}
              </p>
            ) : null}
            {row.durationMs != null ? (
              <p
                className="win95-muted"
                style={{ margin: '4px 0 0', fontSize: 12 }}
              >
                {row.durationMs} ms
              </p>
            ) : null}
          </Frame>
        ))}
        {results.length === 0 && !loading ? (
          <Frame boxShadow="$out" p="$10">
            <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
              Press &quot;Run checks&quot; to verify connectivity.
            </p>
          </Frame>
        ) : null}
      </Frame>
    </Frame>
  )
}
