import { Button, Checkbox, Frame, Input } from '@react95/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getSupabase } from '#/shared/api/supabase'
import type { Tables } from '#/shared/types/database.types'
import { Win95InlineAlert } from '#/shared/ui/Win95InlineAlert'

type OrgSettings = Tables<'organization_settings'>
type LiveMenuRow = Pick<Tables<'menus'>, 'id' | 'name' | 'is_live'>

const SETTINGS_QUERY_KEY = ['admin', 'organization-settings'] as const
const SETTINGS_SELECT =
  'id, display_name, coupons_per_year, public_menu_enabled, updated_at, updated_by' as const

const COUPONS_MIN = 1
const COUPONS_MAX = 24

export function AdminOrganizationPage() {
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [couponsPerYear, setCouponsPerYear] = useState<number | string>(3)
  const [publicMenuEnabled, setPublicMenuEnabled] = useState(true)
  const [savedFlash, setSavedFlash] = useState(false)

  const { data, isPending, error: loadError } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async (): Promise<OrgSettings> => {
      const { data: row, error } = await getSupabase()
        .from('organization_settings')
        .select(SETTINGS_SELECT)
        .eq('id', true)
        .single()

      if (error) throw error
      return row
    },
  })

  const { data: liveMenu } = useQuery({
    queryKey: ['admin', 'menus', 'live'],
    queryFn: async (): Promise<LiveMenuRow | null> => {
      const { data: row, error } = await getSupabase()
        .from('menus')
        .select('id, name, is_live')
        .eq('is_live', true)
        .maybeSingle()

      if (error) throw error
      return row
    },
  })

  useEffect(() => {
    if (!data) return
    setDisplayName(data.display_name)
    setCouponsPerYear(data.coupons_per_year)
    setPublicMenuEnabled(data.public_menu_enabled)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = displayName.trim()
      if (!trimmed) {
        throw new Error('Fyll inn et visningsnavn.')
      }

      const count =
        typeof couponsPerYear === 'string'
          ? Number.parseInt(couponsPerYear, 10)
          : couponsPerYear

      if (!Number.isFinite(count) || count < COUPONS_MIN || count > COUPONS_MAX) {
        throw new Error(
          `Kuponger per år må være et tall mellom ${COUPONS_MIN} og ${COUPONS_MAX}.`,
        )
      }

      const { data: row, error } = await getSupabase()
        .from('organization_settings')
        .update({
          display_name: trimmed,
          coupons_per_year: count,
          public_menu_enabled: publicMenuEnabled,
        })
        .eq('id', true)
        .select(SETTINGS_SELECT)
        .single()

      if (error) throw new Error(error.message)
      return row
    },
    onSuccess: (row) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, row)
      queryClient.setQueryData(
        ['organization-settings', 'public-menu-enabled'],
        row.public_menu_enabled,
      )
      void queryClient.invalidateQueries({ queryKey: ['organization-settings'] })
      void queryClient.invalidateQueries({ queryKey: ['public', 'live-menu'] })
      setSavedFlash(true)
    },
  })

  useEffect(() => {
    if (!savedFlash) return
    const t = window.setTimeout(() => setSavedFlash(false), 2500)
    return () => window.clearTimeout(t)
  }, [savedFlash])

  const dirty =
    data != null &&
    (displayName.trim() !== data.display_name ||
      Number(couponsPerYear) !== data.coupons_per_year ||
      publicMenuEnabled !== data.public_menu_enabled)

  const formattedUpdated =
    data?.updated_at != null
      ? new Intl.DateTimeFormat('nb-NO', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(data.updated_at))
      : null

  const menuIsPubliclyLive = publicMenuEnabled && liveMenu != null

  return (
    <Frame display="flex" flexDirection="column" gap="$12">
      <Frame display="flex" flexDirection="column" gap="$4">
        <h2 style={{ margin: 0, fontSize: 18 }}>Organisasjon</h2>
        <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
          Globale innstillinger for kaffebaren. Endringer i kuponger per år gjelder
          ved neste tildeling (nytt medlem som har betalt i år, eller «Oppfrisk
          årskuponger»).
        </p>
      </Frame>

      {loadError != null ? (
        <Win95InlineAlert title="Kunne ikke laste">
          {loadError instanceof Error ? loadError.message : 'Ukjent feil'}
        </Win95InlineAlert>
      ) : null}

      {saveMutation.isError ? (
        <Win95InlineAlert title="Kunne ikke lagre">
          {saveMutation.error instanceof Error
            ? saveMutation.error.message
            : 'Ukjent feil'}
        </Win95InlineAlert>
      ) : null}

      {savedFlash ? (
        <Win95InlineAlert title="Lagret">
          Innstillingene er oppdatert.
        </Win95InlineAlert>
      ) : null}

      <Frame
        boxShadow="$out"
        p="$10"
        display="flex"
        flexDirection="column"
        gap="$12"
      >
        <div className="win95-field">
          <label htmlFor="org-display-name">Visningsnavn</label>
          <Input
            id="org-display-name"
            value={displayName}
            disabled={isPending || saveMutation.isPending}
            onChange={(e) => setDisplayName(e.currentTarget.value)}
            style={{ width: '100%' }}
          />
          <span className="win95-muted" style={{ fontSize: 12 }}>
            Navnet som brukes internt for organisasjonen.
          </span>
        </div>

        <div className="win95-field">
          <label htmlFor="org-coupons-per-year">Kuponger per år</label>
          <Input
            id="org-coupons-per-year"
            type="number"
            min={COUPONS_MIN}
            max={COUPONS_MAX}
            value={couponsPerYear}
            disabled={isPending || saveMutation.isPending}
            onChange={(e) => setCouponsPerYear(e.currentTarget.value)}
            style={{ maxWidth: 120 }}
          />
          <span className="win95-muted" style={{ fontSize: 12 }}>
            Antall ubrukte kuponger som tildeles hvert medlem som har betalt i år
            ({COUPONS_MIN}–{COUPONS_MAX}).
          </span>
        </div>

        <div className="win95-field">
          <Frame
            display="flex"
            flexWrap="wrap"
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
          >
            <Checkbox
              checked={publicMenuEnabled}
              disabled={isPending || saveMutation.isPending}
              onChange={(e) => setPublicMenuEnabled(e.currentTarget.checked)}
            >
              Vis meny for offentligheten
            </Checkbox>
            {menuIsPubliclyLive ? (
              <span
                className="win95-menu-live-badge"
                aria-label="Menyen er live for offentligheten"
              >
                LIVE
              </span>
            ) : null}
          </Frame>
          <span className="win95-muted" style={{ fontSize: 12 }}>
            Når dette er av, skjules Meny-appen helt for offentligheten
            (skrivebord, Start-meny og direkte lenker).
          </span>
          {liveMenu != null ? (
            <span className="win95-org-live-menu" style={{ fontSize: 12 }}>
              <span className="win95-menu-live-dot" title="Live" aria-hidden />
              <span>
                Live-meny: <strong>{liveMenu.name}</strong>
                {!publicMenuEnabled ? ' (skjult for offentligheten)' : null}
              </span>
            </span>
          ) : (
            <span className="win95-muted" style={{ fontSize: 12 }}>
              Ingen meny er satt som live ennå. Velg «Sett som live» under Meny.
            </span>
          )}
        </div>
      </Frame>

      <Frame
        display="flex"
        flexWrap="wrap"
        alignItems="center"
        justifyContent="space-between"
        gap="$8"
      >
        <span className="win95-muted" style={{ fontSize: 12 }}>
          {formattedUpdated != null
            ? `Sist lagret: ${formattedUpdated}`
            : isPending
              ? 'Laster…'
              : null}
        </span>
        <Button
          disabled={
            isPending || saveMutation.isPending || !dirty || loadError != null
          }
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'Lagrer…' : 'Lagre'}
        </Button>
      </Frame>
    </Frame>
  )
}
