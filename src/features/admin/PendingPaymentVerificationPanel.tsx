import { Button, Frame } from '@react95/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { getSupabase } from '#/shared/api/supabase'
import {
  formatPendingMemberName,
  type PendingVerificationRow,
} from '#/features/admin/payment-verification'
import { MEMBER_LOG_MAX_HEIGHT } from '#/features/admin/member-log-ui'
import {
  Table,
  TableBody,
  TableDataCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '#/shared/ui/Win95Table'

export const PENDING_PAYMENT_VERIFICATION_QUERY_KEY = [
  'admin',
  'payment-pending-verification',
] as const

const PENDING_SELECT =
  'member_id, year, marked_paid_at, imports_without_verification, last_import_missed_at, member_first_name, member_last_name, member_phone, created_at'

const COL_COUNT = 4
const ROW_HEIGHT = 52

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

type PendingPaymentVerificationPanelProps = {
  /** When false, the query stays idle (e.g. inactive tab). Default true. */
  enabled?: boolean
}

export function PendingPaymentVerificationPanel({
  enabled = true,
}: PendingPaymentVerificationPanelProps) {
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: rows, isPending, isFetching, refetch, error } = useQuery({
    queryKey: PENDING_PAYMENT_VERIFICATION_QUERY_KEY,
    enabled,
    queryFn: async (): Promise<PendingVerificationRow[]> => {
      const { data, error: queryError } = await getSupabase()
        .from('member_payment_pending_verification')
        .select(PENDING_SELECT)
        .order('marked_paid_at', { ascending: false })
      if (queryError) throw queryError
      return data
    },
  })

  const list = rows ?? []

  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => list[index]?.member_id ?? index,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() -
        (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0

  const verifyMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error: rpcError } = await getSupabase().rpc(
        'admin_verify_member_payment',
        { p_member_id: memberId },
      )
      if (rpcError) throw new Error(rpcError.message)
      const payload = data as { status?: string } | null
      if (payload?.status !== 'ok') {
        throw new Error(
          payload?.status === 'not_found'
            ? 'Medlemmet var ikke i ventelisten.'
            : 'Kunne ikke verifisere betaling.',
        )
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: PENDING_PAYMENT_VERIFICATION_QUERY_KEY,
      })
    },
  })

  return (
    <Frame
      display="flex"
      flexDirection="column"
      gap="$2"
      style={{ minHeight: 0, height: '100%' }}
    >
      <p style={{ margin: 0, fontSize: 13 }}>
        Markert som betalt i Registrer kupong, men ikke bekreftet i
        medlemslista ennå.
      </p>

      <Frame display="flex" gap="$2" flexWrap="wrap">
        <Button disabled={isFetching} onClick={() => void refetch()}>
          {isFetching && !isPending ? 'Oppdaterer…' : 'Oppdater'}
        </Button>
        <span className="win95-muted" style={{ fontSize: 12, alignSelf: 'center' }}>
          {list.length} venter
        </span>
      </Frame>

      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
          {error instanceof Error ? error.message : 'Kunne ikke hente listen.'}
        </p>
      ) : null}

      {verifyMutation.isError ? (
        <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
          {verifyMutation.error instanceof Error
            ? verifyMutation.error.message
            : 'Verifisering feilet.'}
        </p>
      ) : null}

      {isPending ? (
        <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
          Laster…
        </p>
      ) : list.length === 0 ? (
        <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
          Ingen betalinger venter på verifisering.
        </p>
      ) : (
        <Table
          ref={scrollRef}
          minWidth={360}
          className="admin-members-log-scroll"
          style={{ maxHeight: MEMBER_LOG_MAX_HEIGHT + 80, flex: 1 }}
        >
          <TableHead>
            <TableRow>
              <TableHeadCell>Medlem</TableHeadCell>
              <TableHeadCell>Markert</TableHeadCell>
              <TableHeadCell>Importer</TableHeadCell>
              <TableHeadCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {paddingTop > 0 ? (
              <tr aria-hidden>
                <td
                  colSpan={COL_COUNT}
                  style={{ height: paddingTop, padding: 0, border: 0 }}
                />
              </tr>
            ) : null}
            {virtualRows.map((virtualRow) => {
              const row = list[virtualRow.index]
              if (!row) return null
              const missed = row.imports_without_verification > 0
              return (
                <TableRow
                  key={row.member_id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={
                    missed
                      ? { background: '#fff3cd' }
                      : undefined
                  }
                >
                  <TableDataCell>
                    <div>{formatPendingMemberName(row)}</div>
                    <div className="win95-muted" style={{ fontSize: 11 }}>
                      {row.member_phone ?? '—'}
                    </div>
                  </TableDataCell>
                  <TableDataCell>
                    {formatTimestamp(row.marked_paid_at)}
                  </TableDataCell>
                  <TableDataCell>
                    {missed ? (
                      <span style={{ color: '#8a6d00', fontWeight: 600 }}>
                        Ikke bekreftet i {row.imports_without_verification}{' '}
                        {row.imports_without_verification === 1
                          ? 'import'
                          : 'importer'}
                      </span>
                    ) : (
                      <span className="win95-muted">Venter på import</span>
                    )}
                  </TableDataCell>
                  <TableDataCell>
                    <Button
                      disabled={
                        verifyMutation.isPending &&
                        verifyMutation.variables === row.member_id
                      }
                      onClick={() => verifyMutation.mutate(row.member_id)}
                    >
                      {verifyMutation.isPending &&
                      verifyMutation.variables === row.member_id
                        ? '…'
                        : 'Verifiser'}
                    </Button>
                  </TableDataCell>
                </TableRow>
              )
            })}
            {paddingBottom > 0 ? (
              <tr aria-hidden>
                <td
                  colSpan={COL_COUNT}
                  style={{ height: paddingBottom, padding: 0, border: 0 }}
                />
              </tr>
            ) : null}
          </TableBody>
        </Table>
      )}
    </Frame>
  )
}
