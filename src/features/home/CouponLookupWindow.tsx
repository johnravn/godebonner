import { Button, Checkbox, Frame, Input } from '@react95/core'
import { useMutation } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { getSupabase } from '#/shared/api/supabase'
import { normalizeMemberPhone } from '#/shared/lib/phone'
import { Win95StatusGroup } from '#/shared/ui/Win95StatusGroup'

type PublicCouponSlot = {
  used: boolean
  used_at: string | null
}

type CouponLookupCandidate = {
  member_id: string
  first_name: string | null
  last_name: string | null
}

type CouponLookupPayload =
  | { status: 'invalid_phone' }
  | { status: 'not_found' }
  | { status: 'multiple'; candidates: CouponLookupCandidate[] }
  | {
      status: 'ok'
      paid: boolean
      coupons_remaining: number
      first_name: string | null
      coupons: PublicCouponSlot[]
    }

function parsePublicCoupons(value: unknown): PublicCouponSlot[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const o = row as Record<string, unknown>
      return {
        used: Boolean(o.used),
        used_at: typeof o.used_at === 'string' ? o.used_at : null,
      }
    })
    .filter((c): c is PublicCouponSlot => c !== null)
}

function parseCandidates(value: unknown): CouponLookupCandidate[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const o = row as Record<string, unknown>
      if (typeof o.member_id !== 'string') return null
      return {
        member_id: o.member_id,
        first_name: typeof o.first_name === 'string' ? o.first_name : null,
        last_name: typeof o.last_name === 'string' ? o.last_name : null,
      }
    })
    .filter((c): c is CouponLookupCandidate => c !== null)
}

function parseLookupPayload(value: unknown): CouponLookupPayload {
  if (!value || typeof value !== 'object') {
    return { status: 'invalid_phone' }
  }
  const o = value as Record<string, unknown>
  if (o.status === 'invalid_phone') return { status: 'invalid_phone' }
  if (o.status === 'not_found') return { status: 'not_found' }
  if (o.status === 'multiple') {
    return { status: 'multiple', candidates: parseCandidates(o.candidates) }
  }
  if (o.status !== 'ok') return { status: 'invalid_phone' }
  const remaining = Number(o.coupons_remaining)
  const couponsRemaining = Number.isFinite(remaining) ? remaining : 0
  let coupons = parsePublicCoupons(o.coupons)

  // Older API responses only returned a count — synthesize tiles so the UI
  // still matches admin when `coupons` is missing.
  if (coupons.length === 0 && Boolean(o.paid) && couponsRemaining > 0) {
    coupons = Array.from({ length: couponsRemaining }, () => ({
      used: false,
      used_at: null,
    }))
  }

  return {
    status: 'ok',
    paid: Boolean(o.paid),
    coupons_remaining: couponsRemaining,
    first_name: typeof o.first_name === 'string' ? o.first_name : null,
    coupons,
  }
}

function candidateLabel(c: CouponLookupCandidate): string {
  const name = [c.first_name, c.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ')
  return name || 'Medlem'
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

function lookupMessage(payload: CouponLookupPayload | undefined) {
  if (!payload) return null

  if (payload.status === 'invalid_phone') {
    return {
      title: 'Sjekk telefonnummeret',
      body: 'Vi fant ikke et gyldig telefonnummer. Prøv med åtte siffer (f.eks. 91234567).',
    }
  }

  if (payload.status === 'not_found') {
    return {
      title: 'Fant ingen medlem',
      body: 'Det finnes ingen registrert med dette nummeret ennå. Ta kontakt dersom du mener dette er feil.',
    }
  }

  if (payload.status === 'multiple') {
    return {
      title: 'Flere medlemmer har dette nummeret',
      body: 'Hvilket medlem vil du se?',
    }
  }

  const name = payload.first_name?.trim()
  const greeting = name ? `Hei, ${name}!` : 'Hei!'

  if (!payload.paid) {
    return {
      title: greeting,
      body: 'Du har ikke betalt i år, så det er ingen aktive kuponger.',
    }
  }

  if (payload.coupons_remaining <= 0 && payload.coupons.every((c) => c.used)) {
    return {
      title: greeting,
      body: 'Du har ingen kuponger igjen på kontoen din akkurat nå.',
    }
  }

  if (payload.coupons.length === 0) {
    return {
      title: greeting,
      body: 'Du har ingen kuponger tildelt akkurat nå.',
    }
  }

  const n = payload.coupons_remaining
  const word = n === 1 ? 'kupong' : 'kuponger'

  return {
    title: greeting,
    body:
      n <= 0
        ? 'Du har ingen kuponger igjen på kontoen din akkurat nå.'
        : `Du har ${n} ${word} igjen å bruke.`,
  }
}

export function CouponLookupWindow() {
  const [phone, setPhone] = useState('')

  const lookup = useMutation({
    mutationFn: async (args: { phone: string; memberId?: string }) => {
      const { data, error } = await getSupabase().rpc('get_coupons_by_phone', {
        p_phone: args.phone,
        ...(args.memberId ? { p_member_id: args.memberId } : {}),
      })
      if (error) throw new Error(error.message)
      return parseLookupPayload(data)
    },
  })

  function handleSubmit(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.()
    lookup.mutate({ phone })
  }

  function handlePickMember(memberId: string) {
    lookup.mutate({ phone, memberId })
  }

  const message = lookupMessage(lookup.data)
  const okPayload =
    lookup.isSuccess && lookup.data.status === 'ok' ? lookup.data : null
  const multiplePayload =
    lookup.isSuccess && lookup.data.status === 'multiple'
      ? lookup.data
      : null
  const showCouponTiles =
    Boolean(okPayload?.paid) && (okPayload?.coupons.length ?? 0) > 0

  let statusTitle: string | null = null
  let statusBody: ReactNode =
    'Skriv inn telefonnummer og trykk «Se kuponger».'

  if (lookup.isPending) {
    statusBody = 'Henter…'
  } else if (lookup.isError) {
    statusTitle = 'Noe gikk galt'
    statusBody =
      lookup.error instanceof Error
        ? lookup.error.message
        : 'Prøv igjen om litt.'
  } else if (lookup.isSuccess && message) {
    statusTitle = message.title
    if (multiplePayload) {
      statusBody = (
        <>
          <span style={{ display: 'block', marginBottom: 8 }}>
            {message.body}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {multiplePayload.candidates.map((c) => (
              <Button
                key={c.member_id}
                type="button"
                disabled={lookup.isPending}
                onClick={() => handlePickMember(c.member_id)}
                style={{ width: '100%' }}
              >
                {candidateLabel(c)}
              </Button>
            ))}
          </div>
        </>
      )
    } else if (okPayload?.paid) {
      statusBody = (
        <>
          {message.body}
          <span
            className="win95-muted"
            style={{ display: 'block', marginTop: 8, fontSize: 12 }}
          >
            Lagret nummer: {normalizeMemberPhone(phone) ?? '—'}
          </span>
        </>
      )
    } else {
      statusBody = message.body
    }
  }

  return (
    <>
      <img
        src="/godebonner_kaffebar_v2.png"
        alt="Godebonner kaffebar"
        style={{
          width: '100%',
          maxHeight: 140,
          objectFit: 'contain',
        }}
      />

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
      >
        <div className="win95-field">
          <label htmlFor="phone">Telefonnummer</label>
          <Input
            id="phone"
            placeholder="f.eks. 912 34 567"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            enterKeyHint="search"
            value={phone}
            onChange={(e) => {
              setPhone(e.currentTarget.value)
              lookup.reset()
            }}
            style={{ width: '100%' }}
          />
        </div>

        <Button
          type="submit"
          disabled={lookup.isPending}
          style={{ width: '100%', marginTop: 4 }}
        >
          {lookup.isPending ? 'Søker…' : 'Se kuponger'}
        </Button>
      </form>

      {showCouponTiles && okPayload ? (
        <Frame display="flex" flexDirection="column" gap="$2">
          <p style={{ margin: 0, fontSize: 13, fontWeight: 'bold' }}>
            Kuponger ({okPayload.coupons_remaining} ubrukte)
          </p>
          <Frame
            display="flex"
            flexDirection="row"
            gap="$2"
            className="win95-coupon-slots"
          >
            {okPayload.coupons.map((coupon, index) => (
              <div
                key={`${index}-${coupon.used_at ?? 'open'}`}
                className={`win95-coupon-slot win95-coupon-slot--readonly${coupon.used ? ' win95-coupon-slot--used' : ''}`}
              >
                <Checkbox checked={coupon.used} readOnly tabIndex={-1} />
                <span className="win95-coupon-slot__label">
                  <span className="win95-coupon-slot__title">
                    Kupong {index + 1}
                  </span>
                  {coupon.used ? (
                    <span className="win95-coupon-slot__meta win95-muted">
                      Brukt {formatUsedAt(coupon.used_at)}
                    </span>
                  ) : (
                    <span className="win95-coupon-slot__meta win95-muted">
                      Ubrukt
                    </span>
                  )}
                </span>
              </div>
            ))}
          </Frame>
        </Frame>
      ) : null}

      <Win95StatusGroup legend="Melding" title={statusTitle}>
        {statusBody}
      </Win95StatusGroup>
    </>
  )
}
