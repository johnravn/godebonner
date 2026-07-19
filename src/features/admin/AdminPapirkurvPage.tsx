import { Button, Frame, Input } from '@react95/core'
import { Delete, FilePen } from '@react95/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getSupabase } from '#/shared/api/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '#/shared/types/database.types'
import { React95IconPicker } from '#/shared/ui/React95IconPicker'
import { Win95Dialog } from '#/shared/ui/Win95Dialog'
import { Win95IconButton } from '#/shared/ui/Win95IconButton'
import { Win95Table } from '#/shared/ui/Win95Table'
import {
  RECYCLE_BIN_DEFAULT_ICON,
  RecycleBinItemIcon,
  coerceIconValue,
} from '#/shared/ui/recycle-bin-icons'

type RecycleBinRow = Tables<'recycle_bin_items'>

export function AdminPapirkurvPage() {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState(RECYCLE_BIN_DEFAULT_ICON)
  const [sortOrder, setSortOrder] = useState<number | string>(0)
  const [itemToDelete, setItemToDelete] = useState<RecycleBinRow | null>(null)

  const isEdit = editingId !== null

  const { data: items, isPending } = useQuery({
    queryKey: ['admin', 'recycle-bin'],
    queryFn: async (): Promise<RecycleBinRow[]> => {
      const { data, error } = await getSupabase()
        .from('recycle_bin_items')
        .select('id, name, description, icon, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
  })

  const rows = useMemo(() => items ?? [], [items])

  function openCreate() {
    setEditingId(null)
    setName('')
    setDescription('')
    setIcon(RECYCLE_BIN_DEFAULT_ICON)
    setSortOrder(rows.length)
    setEditOpen(true)
  }

  function openEdit(item: RecycleBinRow) {
    setEditingId(item.id)
    setName(item.name)
    setDescription(item.description)
    setIcon(coerceIconValue(item.icon, RECYCLE_BIN_DEFAULT_ICON))
    setSortOrder(item.sort_order)
    setEditOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim()
      if (!trimmedName) {
        throw new Error('Fyll inn et navn.')
      }

      const order =
        typeof sortOrder === 'string' ? Number.parseInt(sortOrder, 10) : sortOrder
      if (!Number.isFinite(order)) {
        throw new Error('Sortering må være et tall.')
      }

      if (isEdit) {
        const patch: TablesUpdate<'recycle_bin_items'> = {
          name: trimmedName,
          description: description.trim(),
          icon,
          sort_order: order,
        }
        const { error } = await getSupabase()
          .from('recycle_bin_items')
          .update(patch)
          .eq('id', editingId)
        if (error) throw new Error(error.message)
        return
      }

      const insert: TablesInsert<'recycle_bin_items'> = {
        name: trimmedName,
        description: description.trim(),
        icon,
        sort_order: order,
      }
      const { error } = await getSupabase().from('recycle_bin_items').insert(insert)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'recycle-bin'] })
      void queryClient.invalidateQueries({ queryKey: ['public', 'recycle-bin'] })
      setEditOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from('recycle_bin_items')
        .delete()
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'recycle-bin'] })
      void queryClient.invalidateQueries({ queryKey: ['public', 'recycle-bin'] })
      setItemToDelete(null)
    },
  })

  return (
    <Frame display="flex" flexDirection="column" gap="$4">
      <Frame
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        flexWrap="wrap"
        gap="$3"
      >
        <Frame display="flex" flexDirection="column" gap="$1" maxWidth="640px">
          <h2 style={{ margin: 0, fontSize: 18 }}>Papirkurv</h2>
          <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
            Easter egg på skrivebordet. Besøkende kan åpne papirkurven og se det du legger
            her — ingen sletting eller gjenoppretting, bare litt moro.
          </p>
        </Frame>
        <Button onClick={openCreate}>Legg til element</Button>
      </Frame>

      <Win95Table minWidth={560}>
        <thead>
          <tr>
            <th style={{ width: 72 }}>Sortering</th>
            <th style={{ width: 48 }}>Ikon</th>
            <th>Navn</th>
            <th>Beskrivelse</th>
            <th style={{ width: 120 }} />
          </tr>
        </thead>
        <tbody>
          {isPending ? (
            <tr>
              <td colSpan={5}>Laster…</td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.sort_order}</td>
              <td>
                <RecycleBinItemIcon icon={row.icon} size={24} />
              </td>
              <td>{row.name}</td>
              <td className="win95-muted" style={{ fontSize: 12 }}>
                {row.description.trim() || '—'}
              </td>
              <td>
                <Frame display="flex" gap="$4" justifyContent="flex-end">
                  <Win95IconButton
                    label="Rediger"
                    onClick={() => openEdit(row)}
                  >
                    <FilePen variant="32x32_4" width={32} height={32} />
                  </Win95IconButton>
                  <Win95IconButton
                    label="Slett"
                    onClick={() => setItemToDelete(row)}
                  >
                    <Delete variant="16x16_4" width={32} height={32} />
                  </Win95IconButton>
                </Frame>
              </td>
            </tr>
          ))}
          {!isPending && rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="win95-muted">
                Papirkurven er tom. Legg til noe morsomt.
              </td>
            </tr>
          ) : null}
        </tbody>
      </Win95Table>

      {saveMutation.isError && saveMutation.error instanceof Error ? (
        <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
          {saveMutation.error.message}
        </p>
      ) : null}
      {deleteMutation.isError && deleteMutation.error instanceof Error ? (
        <p style={{ margin: 0, fontSize: 13, color: '#c00000' }}>
          {deleteMutation.error.message}
        </p>
      ) : null}

      <Win95Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={isEdit ? 'Rediger element' : 'Nytt element'}
        width="480px"
        minHeight="420px"
      >
        <div className="win95-field">
          <label htmlFor="recycle-name">Navn</label>
          <Input
            id="recycle-name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="win95-field">
          <label htmlFor="recycle-description">Beskrivelse (valgfritt)</label>
          <Input
            id="recycle-description"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            style={{ width: '100%' }}
          />
        </div>
        <React95IconPicker
          value={icon}
          onChange={setIcon}
          labelId="recycle-icon-label"
          defaultIcon={RECYCLE_BIN_DEFAULT_ICON}
        />
        <div className="win95-field">
          <label htmlFor="recycle-sort">Sortering</label>
          <Input
            id="recycle-sort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.currentTarget.value)}
            style={{ width: '100%' }}
          />
        </div>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setEditOpen(false)}>Avbryt</Button>
          <Button
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Lagrer…' : 'Lagre'}
          </Button>
        </Frame>
      </Win95Dialog>

      <Win95Dialog
        open={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        title="Slett element"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Slette {itemToDelete?.name ?? ''} fra papirkurven? Dette kan ikke angres.
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setItemToDelete(null)}>Avbryt</Button>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (!itemToDelete) return
              deleteMutation.mutate(itemToDelete.id)
            }}
          >
            {deleteMutation.isPending ? 'Sletter…' : 'Slett'}
          </Button>
        </Frame>
      </Win95Dialog>
    </Frame>
  )
}
