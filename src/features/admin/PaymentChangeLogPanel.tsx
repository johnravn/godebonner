import { Button, Frame } from '@react95/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useState } from 'react'
import { getSupabase } from '#/shared/api/supabase'
import { Win95Dialog } from '#/shared/ui/Win95Dialog'
import { MEMBER_LOG_MAX_HEIGHT } from '#/features/admin/member-log-ui'
import {
  downloadPaymentChangeLogCsv,
  formatPaymentChangeMemberName,
  type PaymentChangeLogRow,
} from '#/features/admin/payment-change-log'
import {
  Table,
  TableBody,
  TableDataCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '#/shared/ui/Win95Table'

const LOG_SELECT =
  'id, created_at, member_id, member_first_name, member_last_name, member_phone, member_external_id, year, paid, previous_paid, changed_by, changed_by_email'

const LOG_COL_COUNT = 4
const LOG_ROW_HEIGHT = 40

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function paidLabel(paid: boolean | null): string {
  if (paid == null) return '—'
  return paid ? 'Betalt' : 'Ikke betalt'
}

type PaymentChangeLogPanelProps = {
  /** When false, the query stays idle (e.g. inactive tab). Default true. */
  enabled?: boolean
}

export function PaymentChangeLogPanel({
  enabled = true,
}: PaymentChangeLogPanelProps) {
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [clearOpen, setClearOpen] = useState(false)

  const { data: rows, isPending, isFetching, refetch, error } = useQuery({
    queryKey: ['admin', 'payment-change-log'],
    enabled,
    queryFn: async (): Promise<PaymentChangeLogRow[]> => {
      const { data, error: queryError } = await getSupabase()
        .from('member_payment_change_log')
        .select(LOG_SELECT)
        .order('created_at', { ascending: false })
        .limit(1000)
      if (queryError) throw queryError
      return data
    },
  })

  const list = rows ?? []

  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LOG_ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => list[index]?.id ?? index,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() -
        (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0

  const clearMutation = useMutation({
    mutationFn: async () => {
      // PostgREST requires a filter; match every row (same pattern as slett alle medlemmer).
      const { error: clearError } = await getSupabase()
        .from('member_payment_change_log')
        .delete()
        .gte('created_at', '1970-01-01')
      if (clearError) throw new Error(clearError.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'payment-change-log'],
      })
      setClearOpen(false)
    },
  })

  return (
    <Frame display="flex" flexDirection="column" gap="$2" style={{ minHeight: 0 }}>
      <p style={{ margin: 0, fontSize: 13 }}>
        Endringer av «betalt i år» fra Registrer kupong.
      </p>

      <Frame display="flex" gap="$2" flexWrap="wrap">
        <Button disabled={isFetching} onClick={() => void refetch()}>
          {isFetching && !isPending ? 'Oppdaterer…' : 'Oppdater'}
        </Button>
        <Button
          disabled={list.length === 0}
          onClick={() => downloadPaymentChangeLogCsv(list)}
        >
          Eksporter CSV
        </Button>
        <Button
          disabled={list.length === 0 || clearMutation.isPending}
          onClick={() => setClearOpen(true)}
        >
          Tøm betalingslogg
        </Button>
      </Frame>

      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
          {error instanceof Error ? error.message : 'Kunne ikke hente loggen.'}
        </p>
      ) : null}

      {isPending ? (
        <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
          Laster…
        </p>
      ) : list.length === 0 ? (
        <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
          Ingen betalingsendringer er logget ennå.
        </p>
      ) : (
        <Table
          ref={scrollRef}
          minWidth={640}
          className="admin-members-log-scroll"
          style={{ maxHeight: MEMBER_LOG_MAX_HEIGHT }}
        >
          <TableHead>
            <TableRow>
              <TableHeadCell>Tidspunkt</TableHeadCell>
              <TableHeadCell>Medlem</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>Bruker</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paddingTop > 0 ? (
              <tr aria-hidden>
                <td
                  colSpan={LOG_COL_COUNT}
                  style={{ height: paddingTop, padding: 0, border: 0 }}
                />
              </tr>
            ) : null}
            {virtualRows.map((virtualRow) => {
              const row = list[virtualRow.index]
              if (!row) return null
              return (
                <TableRow
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                >
                  <TableDataCell>{formatTimestamp(row.created_at)}</TableDataCell>
                  <TableDataCell>
                    <div>{formatPaymentChangeMemberName(row)}</div>
                    <div className="win95-muted" style={{ fontSize: 11 }}>
                      {[row.member_phone, row.year ? `År ${row.year}` : null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </TableDataCell>
                  <TableDataCell>
                    {paidLabel(row.previous_paid)} → {paidLabel(row.paid)}
                  </TableDataCell>
                  <TableDataCell>{row.changed_by_email ?? '—'}</TableDataCell>
                </TableRow>
              )
            })}
            {paddingBottom > 0 ? (
              <tr aria-hidden>
                <td
                  colSpan={LOG_COL_COUNT}
                  style={{ height: paddingBottom, padding: 0, border: 0 }}
                />
              </tr>
            ) : null}
          </TableBody>
        </Table>
      )}

      <Win95Dialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Tøm betalingslogg"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Slette alle {list.length} poster i betalingsloggen? Dette kan ikke
          angres.
        </p>
        <p className="win95-muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
          Kun ment for utvikling / testing.
        </p>
        {clearMutation.isError ? (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#c00000' }}>
            {clearMutation.error instanceof Error
              ? clearMutation.error.message
              : 'Kunne ikke tømme loggen.'}
          </p>
        ) : null}
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setClearOpen(false)}>Avbryt</Button>
          <Button
            disabled={clearMutation.isPending}
            onClick={() => clearMutation.mutate()}
          >
            {clearMutation.isPending ? 'Tømmer…' : 'Tøm logg'}
          </Button>
        </Frame>
      </Win95Dialog>
    </Frame>
  )
}
