import { Button, Checkbox, Frame } from '@react95/core'
import { Delete } from '@react95/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getSupabase } from '#/shared/api/supabase'
import { useAuth } from '#/app/providers/AuthProvider'
import type { Tables } from '#/shared/types/database.types'
import { Win95Dialog } from '#/shared/ui/Win95Dialog'
import { Win95IconButton } from '#/shared/ui/Win95IconButton'
import {
  Table,
  TableBody,
  TableDataCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '#/shared/ui/Win95Table'

type ProfileRow = Tables<'profiles'>

type UserSortKey = 'email' | 'is_admin' | 'created_at'
type SortDir = 'asc' | 'desc'

const USER_COL_COUNT = 4

type DeleteStatus =
  | 'ok'
  | 'not_authenticated'
  | 'forbidden'
  | 'cannot_delete_self'
  | 'not_found'
  | 'last_admin'

function deleteStatusMessage(status: DeleteStatus): string {
  switch (status) {
    case 'not_authenticated':
      return 'Du må være innlogget.'
    case 'forbidden':
      return 'Du har ikke tilgang til å slette brukere.'
    case 'cannot_delete_self':
      return 'Du kan ikke slette din egen bruker.'
    case 'not_found':
      return 'Brukeren ble ikke funnet.'
    case 'last_admin':
      return 'Kan ikke slette den siste administratoren.'
    default:
      return 'Kunne ikke slette brukeren.'
  }
}

export function AdminUsersPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<{
    profile: ProfileRow
    nextAdmin: boolean
  } | null>(null)
  const [userToDelete, setUserToDelete] = useState<ProfileRow | null>(null)
  const [sortKey, setSortKey] = useState<UserSortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data: profiles, isPending } = useQuery({
    queryKey: ['admin', 'profiles'],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('id, email, is_admin, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })

  const rows = useMemo(() => {
    const list = [...(profiles ?? [])]
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortKey === 'is_admin') {
        return (Number(a.is_admin) - Number(b.is_admin)) * dir
      }
      if (sortKey === 'created_at') {
        return (
          (new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()) *
          dir
        )
      }
      const as = (a.email ?? '').toLocaleLowerCase('nb')
      const bs = (b.email ?? '').toLocaleLowerCase('nb')
      return as.localeCompare(bs, 'nb', { sensitivity: 'base' }) * dir
    })
    return list
  }, [profiles, sortKey, sortDir])

  function toggleSort(key: UserSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'created_at' ? 'desc' : 'asc')
  }

  function sortProp(key: UserSortKey): SortDir | false {
    return sortKey === key ? sortDir : false
  }

  const updateMutation = useMutation({
    mutationFn: async ({ id, is_admin }: { id: string; is_admin: boolean }) => {
      const { error } = await getSupabase()
        .from('profiles')
        .update({ is_admin })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'profiles'] })
      void queryClient.invalidateQueries({ queryKey: ['auth', 'is-admin'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await getSupabase().rpc('admin_delete_user', {
        p_user_id: id,
      })
      if (error) throw new Error(error.message)
      const status = ((data as { status?: string } | null)?.status ??
        'error') as DeleteStatus | 'error'
      if (status !== 'ok') {
        throw new Error(
          deleteStatusMessage(status === 'error' ? 'forbidden' : status),
        )
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'profiles'] })
      setUserToDelete(null)
    },
  })

  function requestToggle(profile: ProfileRow, nextAdmin: boolean) {
    if (profile.id === user?.id && !nextAdmin) {
      return
    }
    setConfirm({ profile, nextAdmin })
  }

  function applyConfirm() {
    if (!confirm) return
    updateMutation.mutate(
      { id: confirm.profile.id, is_admin: confirm.nextAdmin },
      {
        onSettled: () => setConfirm(null),
      },
    )
  }

  return (
    <Frame display="flex" flexDirection="column" gap="$12">
      <Frame display="flex" flexDirection="column" gap="$4">
        <h2 style={{ margin: 0, fontSize: 18 }}>Brukere</h2>
        <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
          Gi eller fjern administratorrettigheter, eller slett brukere. Du kan
          ikke fjerne din egen admin-tilgang eller slette deg selv her.
        </p>
      </Frame>

      <Table minWidth={520}>
        <TableHead>
          <TableRow>
            <TableHeadCell
              sort={sortProp('email')}
              onClick={() => toggleSort('email')}
            >
              E-post
            </TableHeadCell>
            <TableHeadCell
              sort={sortProp('is_admin')}
              onClick={() => toggleSort('is_admin')}
            >
              Admin
            </TableHeadCell>
            <TableHeadCell
              sort={sortProp('created_at')}
              onClick={() => toggleSort('created_at')}
            >
              Opprettet
            </TableHeadCell>
            <TableHeadCell style={{ width: 60 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {isPending ? (
            <TableRow>
              <TableDataCell colSpan={USER_COL_COUNT}>Laster…</TableDataCell>
            </TableRow>
          ) : null}
          {!isPending && rows.length === 0 ? (
            <TableRow>
              <TableDataCell colSpan={USER_COL_COUNT} className="win95-muted">
                Ingen brukere ennå.
              </TableDataCell>
            </TableRow>
          ) : null}
          {!isPending
            ? rows.map((row) => {
                const isSelf = row.id === user?.id
                const busy =
                  updateMutation.isPending ||
                  deleteMutation.isPending ||
                  isPending
                return (
                  <TableRow key={row.id}>
                    <TableDataCell>
                      <div style={{ fontSize: 13 }}>{row.email ?? '—'}</div>
                      <div className="win95-muted" style={{ fontSize: 11 }}>
                        {row.id}
                      </div>
                    </TableDataCell>
                    <TableDataCell>
                      <Checkbox
                        checked={row.is_admin}
                        disabled={isSelf || busy}
                        onChange={(e) =>
                          requestToggle(row, e.currentTarget.checked)
                        }
                        aria-label={`Admin for ${row.email ?? row.id}`}
                      />
                    </TableDataCell>
                    <TableDataCell style={{ fontSize: 13 }}>
                      {new Date(row.created_at).toLocaleString()}
                    </TableDataCell>
                    <TableDataCell>
                      <Frame display="flex" gap="$4" justifyContent="flex-end">
                        <Win95IconButton
                          label={`Slett ${row.email ?? row.id}`}
                          disabled={isSelf || busy}
                          onClick={() => setUserToDelete(row)}
                        >
                          <Delete variant="16x16_4" width={32} height={32} />
                        </Win95IconButton>
                      </Frame>
                    </TableDataCell>
                  </TableRow>
                )
              })
            : null}
        </TableBody>
      </Table>

      {deleteMutation.isError && deleteMutation.error instanceof Error ? (
        <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
          {deleteMutation.error.message}
        </p>
      ) : null}

      <Win95Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Endre administratorrettigheter"
      >
        {confirm ? (
          <p style={{ margin: 0, fontSize: 13 }}>
            {confirm.nextAdmin
              ? `Gi administratorrettigheter til ${confirm.profile.email ?? confirm.profile.id}?`
              : `Fjern administratorrettigheter fra ${confirm.profile.email ?? confirm.profile.id}?`}
          </p>
        ) : null}
        <Frame display="flex" justifyContent="flex-end" gap="$8" mt="$8">
          <Button onClick={() => setConfirm(null)}>Avbryt</Button>
          <Button
            disabled={updateMutation.isPending}
            onClick={() => void applyConfirm()}
          >
            {updateMutation.isPending ? 'Lagrer…' : 'Bekreft'}
          </Button>
        </Frame>
      </Win95Dialog>

      <Win95Dialog
        open={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        title="Slett bruker"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Slette {userToDelete?.email ?? userToDelete?.id ?? ''} permanent?
          Innloggingen fjernes også. Dette kan ikke angres.
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$8" mt="$8">
          <Button onClick={() => setUserToDelete(null)}>Avbryt</Button>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (!userToDelete) return
              deleteMutation.mutate(userToDelete.id)
            }}
          >
            {deleteMutation.isPending ? 'Sletter…' : 'Slett'}
          </Button>
        </Frame>
      </Win95Dialog>
    </Frame>
  )
}
