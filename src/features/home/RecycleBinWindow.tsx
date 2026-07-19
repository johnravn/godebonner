import { Frame } from '@react95/core'
import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '#/shared/api/supabase'
import type { Tables } from '#/shared/types/database.types'
import { RecycleBinItemIcon } from '#/shared/ui/recycle-bin-icons'

type RecycleBinItem = Tables<'recycle_bin_items'>

export function RecycleBinWindow() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['public', 'recycle-bin'],
    queryFn: async (): Promise<RecycleBinItem[]> => {
      const { data: rows, error } = await getSupabase()
        .from('recycle_bin_items')
        .select('id, name, description, icon, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return rows
    },
  })

  if (isPending) {
    return (
      <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
        Laster papirkurv…
      </p>
    )
  }

  if (isError) {
    return (
      <p style={{ margin: 0, color: '#c00000', fontSize: 13 }}>
        Kunne ikke hente papirkurven. Prøv igjen senere.
      </p>
    )
  }

  const items = data

  if (items.length === 0) {
    return (
      <Frame
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="$2"
        style={{ minHeight: 160, textAlign: 'center' }}
      >
        <p style={{ margin: 0, fontSize: 13 }}>Papirkurven er tom.</p>
        <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
          Ingenting å se her. (Enda.)
        </p>
      </Frame>
    )
  }

  return (
    <div className="win95-recycle-list" role="list">
      {items.map((item) => (
        <div key={item.id} className="win95-recycle-list__item" role="listitem">
          <RecycleBinItemIcon icon={item.icon} size={32} />
          <div className="win95-recycle-list__text">
            <div className="win95-recycle-list__name">{item.name}</div>
            {item.description.trim() ? (
              <div className="win95-recycle-list__desc">{item.description}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
