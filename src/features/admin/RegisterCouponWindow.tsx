import { Button, Checkbox, Frame, Input } from '@react95/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { getSupabase } from '#/shared/api/supabase'
import { PENDING_PAYMENT_VERIFICATION_QUERY_KEY } from '#/features/admin/PendingPaymentVerificationPanel'
import { Win95Dialog } from '#/shared/ui/Win95Dialog'
import { Win95StatusGroup } from '#/shared/ui/Win95StatusGroup'

type CouponSlot = {
  id: string
  allocated_at: string
  used_at: string | null
}

type MemberSearchHit = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  birth_year: number | null
  member_type: string | null
  joined_at: string | null
  paid: boolean
  coupons_remaining: number
  last_allocation_at: string | null
  coupons: CouponSlot[]
}

type SearchResponse = {
  status?: string
  members?: MemberSearchHit[]
}

type MemberActionResponse = {
  status?: string
  member?: MemberSearchHit & Record<string, unknown>
  coupons?: CouponSlot[]
}

function parseCoupons(value: unknown): CouponSlot[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const o = row as Record<string, unknown>
      if (typeof o.id !== 'string') return null
      return {
        id: o.id,
        allocated_at: typeof o.allocated_at === 'string' ? o.allocated_at : '',
        used_at: typeof o.used_at === 'string' ? o.used_at : null,
      }
    })
    .filter((c): c is CouponSlot => c !== null)
}

function parseMember(value: unknown): MemberSearchHit | null {
  if (!value || typeof value !== 'object') return null
  const o = value as Record<string, unknown>
  if (typeof o.id !== 'string') return null
  if (typeof o.first_name !== 'string' || typeof o.last_name !== 'string') {
    return null
  }
  if (o.phone != null && typeof o.phone !== 'string') return null
  return {
    id: o.id,
    first_name: o.first_name,
    last_name: o.last_name,
    phone: typeof o.phone === 'string' ? o.phone : null,
    email: typeof o.email === 'string' ? o.email : null,
    address: typeof o.address === 'string' ? o.address : null,
    postal_code: typeof o.postal_code === 'string' ? o.postal_code : null,
    city: typeof o.city === 'string' ? o.city : null,
    birth_year: typeof o.birth_year === 'number' ? o.birth_year : null,
    member_type: typeof o.member_type === 'string' ? o.member_type : null,
    joined_at: typeof o.joined_at === 'string' ? o.joined_at : null,
    paid: Boolean(o.paid),
    coupons_remaining: Number(o.coupons_remaining) || 0,
    last_allocation_at:
      typeof o.last_allocation_at === 'string' ? o.last_allocation_at : null,
    coupons: parseCoupons(o.coupons),
  }
}

function parseSearchResponse(value: unknown): MemberSearchHit[] {
  if (!value || typeof value !== 'object') return []
  const o = value as SearchResponse
  if (o.status !== 'ok' || !Array.isArray(o.members)) return []
  return o.members.map(parseMember).filter((m): m is MemberSearchHit => m !== null)
}

function formatUsedAt(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function applyActionResult(
  data: unknown,
  selected: MemberSearchHit | null,
): MemberSearchHit | null {
  if (!data || typeof data !== 'object') return selected
  const o = data as MemberActionResponse
  if (o.status !== 'ok') return selected
  const member = parseMember({ ...o.member, coupons: o.coupons ?? o.member?.coupons })
  return member ?? selected
}

export function RegisterCouponWindow() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberSearchHit[]>([])
  const [selected, setSelected] = useState<MemberSearchHit | null>(null)
  const [unuseCoupon, setUnuseCoupon] = useState<CouponSlot | null>(null)
  const [statusTitle, setStatusTitle] = useState<string | null>(null)
  const [statusBody, setStatusBody] = useState<ReactNode>(
    'Søk etter medlem med telefon, navn eller e-post.',
  )

  function applyMemberUpdate(data: unknown) {
    const next = applyActionResult(data, selected)
    setSelected(next)
    setResults((prev) =>
      prev.map((m) => (next && m.id === next.id ? next : m)),
    )
    return next
  }

  const searchMutation = useMutation({
    mutationFn: async (raw: string) => {
      const { data, error } = await getSupabase().rpc('admin_search_members', {
        p_query: raw,
      })
      if (error) throw new Error(error.message)
      const payload = data as SearchResponse
      if (payload.status === 'forbidden') {
        throw new Error('Ingen administratortilgang.')
      }
      if (payload.status === 'not_authenticated') {
        throw new Error('Du er ikke innlogget.')
      }
      return parseSearchResponse(data)
    },
    onSuccess: (members) => {
      setResults(members)
      if (members.length === 0) {
        setSelected(null)
        setStatusTitle('Ingen treff')
        setStatusBody('Fant ingen medlemmer som matcher søket.')
        return
      }
      setStatusTitle(null)
      setStatusBody(
        `Fant ${members.length} medlem${members.length === 1 ? '' : 'mer'}. Velg en for å bekrefte.`,
      )
      if (selected) {
        const still = members.find((m) => m.id === selected.id)
        setSelected(still ?? members[0])
      } else {
        setSelected(members[0])
      }
    },
    onError: (err) => {
      setStatusTitle('Søk feilet')
      setStatusBody(err instanceof Error ? err.message : 'Prøv igjen.')
    },
  })

  const paidMutation = useMutation({
    mutationFn: async (paid: boolean) => {
      if (!selected) throw new Error('Ingen medlem valgt.')
      const { data, error } = await getSupabase().rpc('admin_set_member_paid', {
        p_member_id: selected.id,
        p_paid: paid,
      })
      if (error) throw new Error(error.message)
      const payload = data as MemberActionResponse
      if (payload.status !== 'ok') {
        throw new Error(
          payload.status === 'not_found'
            ? 'Medlemmet ble ikke funnet.'
            : 'Kunne ikke oppdatere betaling.',
        )
      }
      return data
    },
    onSuccess: (data) => {
      const next = applyMemberUpdate(data)
      setStatusTitle(next?.paid ? 'Betaling registrert' : 'Betaling fjernet')
      setStatusBody(
        next?.paid
          ? 'Medlemmet er registrert som betalt i år. Kuponger er nå tilgjengelige.'
          : 'Medlemmet er satt til ikke betalt i år. Ubrukte kuponger er fjernet.',
      )
      void queryClient.invalidateQueries({
        queryKey: PENDING_PAYMENT_VERIFICATION_QUERY_KEY,
      })
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'payment-change-log'],
      })
    },
    onError: (err) => {
      setStatusTitle('Betaling feilet')
      setStatusBody(err instanceof Error ? err.message : 'Prøv igjen.')
    },
  })

  const useMutationCoupon = useMutation({
    mutationFn: async (couponId: string) => {
      if (!selected) throw new Error('Ingen medlem valgt.')
      const { data, error } = await getSupabase().rpc('admin_use_member_coupon', {
        p_member_id: selected.id,
        p_coupon_id: couponId,
      })
      if (error) throw new Error(error.message)
      const payload = data as MemberActionResponse
      if (payload.status === 'not_paid') {
        throw new Error('Medlemmet har ikke betalt i år.')
      }
      if (payload.status === 'no_coupons') {
        throw new Error('Ingen kuponger igjen.')
      }
      if (payload.status === 'already_used') {
        throw new Error('Kupongen er allerede brukt.')
      }
      if (payload.status !== 'ok') {
        throw new Error('Kunne ikke bruke kupong.')
      }
      return data
    },
    onSuccess: (data) => {
      const next = applyMemberUpdate(data)
      setStatusTitle('Kupong brukt')
      setStatusBody(
        `1 kupong registrert. ${next?.coupons_remaining ?? 0} igjen.`,
      )
    },
    onError: (err) => {
      setStatusTitle('Kunne ikke bruke kupong')
      setStatusBody(err instanceof Error ? err.message : 'Prøv igjen.')
    },
  })

  const unuseMutationCoupon = useMutation({
    mutationFn: async (couponId: string) => {
      const { data, error } = await getSupabase().rpc(
        'admin_unuse_member_coupon',
        { p_coupon_id: couponId },
      )
      if (error) throw new Error(error.message)
      const payload = data as MemberActionResponse
      if (payload.status === 'not_found') {
        throw new Error('Kupongen ble ikke funnet.')
      }
      if (payload.status === 'not_used') {
        throw new Error('Kupongen er allerede ubrukt.')
      }
      if (payload.status !== 'ok') {
        throw new Error('Kunne ikke gjenopprette kupong.')
      }
      return data
    },
    onSuccess: (data) => {
      setUnuseCoupon(null)
      const next = applyMemberUpdate(data)
      setStatusTitle('Kupong gjenopprettet')
      setStatusBody(
        `Kupongen er ubrukt igjen. ${next?.coupons_remaining ?? 0} ubrukte.`,
      )
    },
    onError: (err) => {
      setUnuseCoupon(null)
      setStatusTitle('Kunne ikke gjenopprette kupong')
      setStatusBody(err instanceof Error ? err.message : 'Prøv igjen.')
    },
  })

  const couponBusy =
    useMutationCoupon.isPending || unuseMutationCoupon.isPending

  function handleSearch(e?: { preventDefault: () => void }) {
    e?.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) {
      setStatusTitle('Skriv et søk')
      setStatusBody('Søk på telefon, navn, e-post eller adresse.')
      return
    }
    searchMutation.mutate(trimmed)
  }

  const periodCoupons = selected
    ? selected.coupons.filter((c) => {
        if (!c.used_at) return true
        if (!selected.last_allocation_at) return true
        return c.allocated_at >= selected.last_allocation_at
      })
    : []
  const unusedCount = periodCoupons.filter((c) => !c.used_at).length

  return (
    <>
      <form onSubmit={handleSearch}>
        <Frame display="flex" flexDirection="column" gap="$2">
          <div className="win95-field">
            <label htmlFor="register-coupon-search">Søk</label>
            <Frame display="flex" gap="$2" alignItems="stretch">
              <Input
                id="register-coupon-search"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder="Telefon, navn eller e-post…"
                style={{ flex: 1, width: '100%' }}
              />
              <Button type="submit" disabled={searchMutation.isPending}>
                {searchMutation.isPending ? 'Søker…' : 'Søk'}
              </Button>
            </Frame>
          </div>
        </Frame>
      </form>

      {results.length > 0 ? (
        <Frame display="flex" flexDirection="column" gap="$1">
          <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
            Treff
          </p>
          <Frame
            as="ul"
            className="win95-register-results"
            boxShadow="$in"
            bgColor="canvas"
            m="$0"
            p="$0"
            style={{ listStyle: 'none', maxHeight: 120, overflow: 'auto' }}
          >
            {results.map((m) => {
              const active = selected?.id === m.id
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`win95-register-results__item${active ? ' win95-register-results__item--active' : ''}`}
                    onClick={() => setSelected(m)}
                  >
                    <strong>
                      {m.first_name} {m.last_name}
                    </strong>
                    <span className="win95-muted">
                      {m.phone ?? '—'}
                      {m.email ? ` · ${m.email}` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </Frame>
        </Frame>
      ) : null}

      {selected ? (
        <Frame
          display="flex"
          flexDirection="column"
          gap="$2"
          boxShadow="$in"
          bgColor="material"
          p="$3"
        >
          <Frame
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            gap="$2"
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 15 }}>
                {selected.first_name} {selected.last_name}
              </h3>
              <p className="win95-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                Bekreft med kunden at dette er riktig medlem.
              </p>
            </div>
            <Button
              disabled={paidMutation.isPending}
              onClick={() => paidMutation.mutate(!selected.paid)}
            >
              {paidMutation.isPending
                ? 'Lagrer…'
                : selected.paid
                  ? 'Fjern betaling for i år'
                  : 'Registrer betaling for i år'}
            </Button>
          </Frame>

          <dl className="win95-member-facts">
            <div>
              <dt>Telefon</dt>
              <dd>{selected.phone ?? '—'}</dd>
            </div>
            <div>
              <dt>E-post</dt>
              <dd>{selected.email ?? '—'}</dd>
            </div>
            <div>
              <dt>Adresse</dt>
              <dd>
                {[selected.address, selected.postal_code, selected.city]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{selected.member_type ?? '—'}</dd>
            </div>
            <div>
              <dt>Fødselsår</dt>
              <dd>{selected.birth_year ?? '—'}</dd>
            </div>
            <div>
              <dt>Innmeldt</dt>
              <dd>{selected.joined_at ?? '—'}</dd>
            </div>
            <div>
              <dt>Betalt i år</dt>
              <dd>{selected.paid ? 'Ja' : 'Nei'}</dd>
            </div>
          </dl>

          <Frame display="flex" flexDirection="column" gap="$2">
            <p style={{ margin: 0, fontSize: 13, fontWeight: 'bold' }}>
              Kuponger ({unusedCount} ubrukte)
            </p>
            {!selected.paid ? (
              <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
                Kun medlemmer som har betalt i år får kuponger. Registrer
                betaling når kunden har betalt.
              </p>
            ) : periodCoupons.length === 0 ? (
              <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
                Ingen kuponger tildelt ennå. Prøv «Oppfrisk årskuponger» under
                Medlemmer, eller registrer betaling på nytt.
              </p>
            ) : (
              <Frame
                display="flex"
                flexDirection="row"
                gap="$2"
                className="win95-coupon-slots"
              >
                {periodCoupons.map((coupon, index) => {
                  const used = Boolean(coupon.used_at)
                  const pendingThis =
                    (useMutationCoupon.isPending &&
                      useMutationCoupon.variables === coupon.id) ||
                    (unuseMutationCoupon.isPending &&
                      unuseMutationCoupon.variables === coupon.id)
                  return (
                    <button
                      key={coupon.id}
                      type="button"
                      className={`win95-coupon-slot${used ? ' win95-coupon-slot--used' : ''}`}
                      disabled={couponBusy || (!used && !selected.paid)}
                      aria-pressed={used}
                      onClick={() => {
                        if (couponBusy) return
                        if (used) {
                          setUnuseCoupon(coupon)
                          return
                        }
                        if (selected.paid) {
                          useMutationCoupon.mutate(coupon.id)
                        }
                      }}
                    >
                      <span className="win95-coupon-slot__check" aria-hidden>
                        <Checkbox
                          checked={used || pendingThis}
                          readOnly
                          tabIndex={-1}
                        />
                      </span>
                      <span className="win95-coupon-slot__label">
                        <span className="win95-coupon-slot__title">
                          Kupong {index + 1}
                        </span>
                        {used ? (
                          <span className="win95-coupon-slot__meta win95-muted">
                            Brukt {formatUsedAt(coupon.used_at)}
                          </span>
                        ) : (
                          <span className="win95-coupon-slot__meta win95-muted">
                            {pendingThis ? 'Registrerer…' : 'Ubrukt'}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </Frame>
            )}
          </Frame>
        </Frame>
      ) : null}

      <Win95StatusGroup legend="Status" title={statusTitle}>
        {statusBody}
      </Win95StatusGroup>

      <Win95Dialog
        open={Boolean(unuseCoupon)}
        onClose={() => setUnuseCoupon(null)}
        title="Gjenopprett kupong"
        width="360px"
        buttons={[
          {
            value: unuseMutationCoupon.isPending
              ? 'Gjenoppretter…'
              : 'Gjenopprett',
            onClick: () => {
              if (unuseCoupon) unuseMutationCoupon.mutate(unuseCoupon.id)
            },
          },
          {
            value: 'Avbryt',
            onClick: () => setUnuseCoupon(null),
          },
        ]}
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Gjøre kupongen ubrukt igjen for{' '}
          <strong>
            {selected?.first_name} {selected?.last_name}
          </strong>
          ?
          {unuseCoupon?.used_at ? (
            <span className="win95-muted" style={{ display: 'block', marginTop: 8 }}>
              Brukt {formatUsedAt(unuseCoupon.used_at)}
            </span>
          ) : null}
        </p>
      </Win95Dialog>
    </>
  )
}
