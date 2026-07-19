import { Frame } from '@react95/core'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getSupabase } from '#/shared/api/supabase'
import type { Tables } from '#/shared/types/database.types'
import {
  formatMenuPrice,
  MenuExplorer,
  type MenuExplorerCategory,
  type MenuExplorerItem,
  type MenuSelection,
} from '#/shared/ui/MenuExplorer'
import {
  REACT95_DEFAULT_ICON,
  React95Icon,
} from '#/shared/ui/react95-icons'

type MenuRow = Tables<'menus'>
type CatalogItemRow = Tables<'menu_catalog_items'>
type MenuCategoryRow = Tables<'menu_categories'>

type MenuItemJoinRow = {
  id: string
  category_id: string
  catalog_item_id: string
  price: number
  is_sold_out: boolean
  sort_order: number
  created_at: string
  menu_catalog_items: Pick<
    CatalogItemRow,
    'id' | 'name' | 'description' | 'icon' | 'default_price'
  > | null
}

type MenuTreeRow = MenuCategoryRow & {
  menu_items: MenuItemJoinRow[] | null
}

type LiveMenuData = {
  menu: MenuRow
  categories: MenuExplorerCategory[]
  items: MenuExplorerItem[]
}

function flattenMenuTree(rows: MenuTreeRow[]): {
  categories: MenuExplorerCategory[]
  items: MenuExplorerItem[]
} {
  const categories: MenuExplorerCategory[] = rows.map(
    ({ menu_items: _items, ...category }) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      sort_order: category.sort_order,
    }),
  )

  const items: MenuExplorerItem[] = rows.flatMap((row) =>
    (row.menu_items ?? []).map((mi) => ({
      id: mi.id,
      category_id: mi.category_id,
      catalog_item_id: mi.catalog_item_id,
      name: mi.menu_catalog_items?.name ?? 'Ukjent vare',
      description: mi.menu_catalog_items?.description ?? '',
      price: mi.price,
      is_sold_out: mi.is_sold_out,
      icon: mi.menu_catalog_items?.icon ?? REACT95_DEFAULT_ICON,
      sort_order: mi.sort_order,
    })),
  )

  return { categories, items }
}

export function MenyWindow() {
  const [selection, setSelection] = useState<MenuSelection | null>(null)

  const { data, isPending, isError } = useQuery({
    queryKey: ['public', 'live-menu'],
    queryFn: async (): Promise<LiveMenuData | null> => {
      const { data: menus, error: menuError } = await getSupabase()
        .from('menus')
        .select('id, name, is_live, group_id, icon, created_at')
        .eq('is_live', true)
        .limit(1)

      if (menuError) throw menuError
      const menu = menus?.[0]
      if (!menu) return null

      const { data: tree, error: treeError } = await getSupabase()
        .from('menu_categories')
        .select(
          `id, menu_id, name, icon, sort_order, created_at,
           menu_items(
             id, category_id, catalog_item_id, price, is_sold_out, sort_order, created_at,
             menu_catalog_items(id, name, description, icon, default_price)
           )`,
        )
        .eq('menu_id', menu.id)
        .order('sort_order', { ascending: true })
        .order('sort_order', { ascending: true, referencedTable: 'menu_items' })

      if (treeError) throw treeError

      const { categories, items } = flattenMenuTree((tree ?? []) as MenuTreeRow[])
      return { menu, categories, items }
    },
  })

  if (isPending) {
    return (
      <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
        Laster meny…
      </p>
    )
  }

  if (isError) {
    return (
      <p style={{ margin: 0, color: '#c00000', fontSize: 13 }}>
        Kunne ikke hente menyen. Prøv igjen senere.
      </p>
    )
  }

  if (!data) {
    return (
      <p className="win95-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>
        Ingen meny er publisert akkurat nå. Kom tilbake snart!
      </p>
    )
  }

  const selectedCategory =
    selection?.type === 'category'
      ? data.categories.find((c) => c.id === selection.id) ?? null
      : null
  const selectedItem =
    selection?.type === 'item'
      ? data.items.find((i) => i.id === selection.id) ?? null
      : null

  return (
    <Frame
      display="flex"
      flexDirection="column"
      gap="$2"
      height="100%"
      style={{ minHeight: 0 }}
    >
      <MenuExplorer
        rootLabel={data.menu.name}
        rootIcon={data.menu.icon}
        categories={data.categories}
        items={data.items}
        selection={selection}
        onSelect={setSelection}
        emptyMessage="Denne menyen har ingen kategorier ennå."
        treeLegend="Meny"
        detailLegend="Detaljer"
      >
        {selectedCategory ? (
          <div>
            <div className="win95-menu-explorer__detail-heading">
              <React95Icon icon={selectedCategory.icon} size={48} />
              <strong style={{ fontSize: 15 }}>{selectedCategory.name}</strong>
            </div>
            <p className="win95-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              Mappe — åpne treet for å se varene.
            </p>
          </div>
        ) : null}

        {selectedItem ? (
          <div
            className={
              selectedItem.is_sold_out ? 'win95-menu-sold-out-detail' : undefined
            }
          >
            <div className="win95-menu-explorer__detail-heading">
              <React95Icon icon={selectedItem.icon} size={48} />
              <strong
                className={selectedItem.is_sold_out ? 'win95-menu-sold-out' : undefined}
                style={{ fontSize: 16 }}
              >
                {selectedItem.name}
              </strong>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 'bold' }}>
              {formatMenuPrice(selectedItem.price)}
            </p>
            {selectedItem.description ? (
              <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.45 }}>
                {selectedItem.description}
              </p>
            ) : null}
            {selectedItem.is_sold_out ? (
              <p className="win95-menu-sold-out-badge">Utsolgt</p>
            ) : null}
          </div>
        ) : null}
      </MenuExplorer>
    </Frame>
  )
}
