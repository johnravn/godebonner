import { Button, Checkbox, Frame, Input, Tab, Tabs } from '@react95/core'
import { Delete, FilePen, New16 } from '@react95/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { getSupabase } from '#/shared/api/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '#/shared/types/database.types'
import {
  formatMenuPrice,
  MenuExplorer,
  type MenuExplorerCategory,
  type MenuExplorerItem,
  type MenuSelection,
} from '#/shared/ui/MenuExplorer'
import { React95IconPicker } from '#/shared/ui/React95IconPicker'
import {
  REACT95_DEFAULT_ICON,
  REACT95_FOLDER_ICON,
  REACT95_MENU_ICON,
  React95Icon,
  coerceIconValue,
} from '#/shared/ui/react95-icons'
import { Win95Dialog } from '#/shared/ui/Win95Dialog'
import { Win95IconButton } from '#/shared/ui/Win95IconButton'
import { Win95Select } from '#/shared/ui/Win95Select'
import {
  Table,
  TableBody,
  TableDataCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '#/shared/ui/Win95Table'

type MenuRow = Tables<'menus'>
type MenuGroupRow = Tables<'menu_groups'>
type CatalogItemRow = Tables<'menu_catalog_items'>
type MenuCategoryRow = Tables<'menu_categories'>

type CatalogSortKey = 'name' | 'default_price' | 'sort_order'
type SortDir = 'asc' | 'desc'

const CATALOG_COL_COUNT = 5

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

type RpcStatusResponse = {
  status?: string
  menu_id?: string
}

function parsePrice(value: number | string): number {
  return typeof value === 'string' ? Number.parseFloat(value.replace(',', '.')) : value
}

function parseSort(value: number | string): number {
  return typeof value === 'string' ? Number.parseInt(value, 10) : value
}

/** Throw a single error listing every invalid/missing field. */
function throwFieldErrors(
  checks: Array<string | false | null | undefined>,
): void {
  const errors = checks.filter((c): c is string => typeof c === 'string')
  if (errors.length === 0) return
  throw new Error(errors.join(' '))
}

function dialogErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Noe gikk galt.'
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

export function AdminMenyPage() {
  const queryClient = useQueryClient()

  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)
  const [selection, setSelection] = useState<MenuSelection | null>(null)
  /** Remount key so React95 Tabs (uncontrolled) can jump to Meny from Grupper. */
  const [tabsKey, setTabsKey] = useState(0)
  const [defaultActiveTab, setDefaultActiveTab] = useState('Meny')

  // Menu dialog
  const [menuDialogOpen, setMenuDialogOpen] = useState(false)
  const [menuEditingId, setMenuEditingId] = useState<string | null>(null)
  const [menuName, setMenuName] = useState('')
  const [menuGroupId, setMenuGroupId] = useState<string>('')
  const [menuIcon, setMenuIcon] = useState(REACT95_MENU_ICON)

  // Group dialog
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupEditingId, setGroupEditingId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const [groupIcon, setGroupIcon] = useState(REACT95_FOLDER_ICON)
  const [groupSort, setGroupSort] = useState<number | string>(0)

  // Copy dialog
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copyName, setCopyName] = useState('')
  const [copyGroupId, setCopyGroupId] = useState<string>('')

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryEditingId, setCategoryEditingId] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categorySort, setCategorySort] = useState<number | string>(0)
  const [categoryIcon, setCategoryIcon] = useState(REACT95_FOLDER_ICON)

  // Placement dialog (add/edit item on menu)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemEditingId, setItemEditingId] = useState<string | null>(null)
  const [itemCategoryId, setItemCategoryId] = useState<string | null>(null)
  const [itemCatalogId, setItemCatalogId] = useState<string>('')
  const [itemCatalogFilter, setItemCatalogFilter] = useState('')
  const [itemPrice, setItemPrice] = useState<number | string>('')
  const [itemSoldOut, setItemSoldOut] = useState(false)
  const [itemSort, setItemSort] = useState<number | string>(0)

  // Catalog bank dialog
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false)
  const [catalogEditingId, setCatalogEditingId] = useState<string | null>(null)
  const [catalogName, setCatalogName] = useState('')
  const [catalogDescription, setCatalogDescription] = useState('')
  const [catalogPrice, setCatalogPrice] = useState<number | string>('')
  const [catalogIcon, setCatalogIcon] = useState(REACT95_DEFAULT_ICON)
  const [catalogSort, setCatalogSort] = useState<number | string>(0)

  const [menuToDelete, setMenuToDelete] = useState<MenuRow | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<MenuGroupRow | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<MenuExplorerCategory | null>(null)
  const [itemToDelete, setItemToDelete] = useState<MenuExplorerItem | null>(null)
  const [catalogToDelete, setCatalogToDelete] = useState<CatalogItemRow | null>(null)
  const [catalogSortKey, setCatalogSortKey] = useState<CatalogSortKey>('sort_order')
  const [catalogSortDir, setCatalogSortDir] = useState<SortDir>('asc')

  const { data: groups, isPending: groupsPending } = useQuery({
    queryKey: ['admin', 'menu-groups'],
    queryFn: async (): Promise<MenuGroupRow[]> => {
      const { data, error } = await getSupabase()
        .from('menu_groups')
        .select('id, name, icon, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
  })

  const { data: menus, isPending: menusPending } = useQuery({
    queryKey: ['admin', 'menus'],
    queryFn: async (): Promise<MenuRow[]> => {
      const { data, error } = await getSupabase()
        .from('menus')
        .select('id, name, is_live, group_id, icon, created_at')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })

  const { data: catalogItems, isPending: catalogPending } = useQuery({
    queryKey: ['admin', 'catalog-items'],
    queryFn: async (): Promise<CatalogItemRow[]> => {
      const { data, error } = await getSupabase()
        .from('menu_catalog_items')
        .select('id, name, description, default_price, icon, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
  })

  const catalogRows = useMemo(() => {
    const list = [...(catalogItems ?? [])]
    const dir = catalogSortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (catalogSortKey === 'default_price' || catalogSortKey === 'sort_order') {
        return (a[catalogSortKey] - b[catalogSortKey]) * dir
      }
      return (
        a.name.localeCompare(b.name, 'nb', { sensitivity: 'base' }) * dir
      )
    })
    return list
  }, [catalogItems, catalogSortKey, catalogSortDir])

  function toggleCatalogSort(key: CatalogSortKey) {
    if (catalogSortKey === key) {
      setCatalogSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setCatalogSortKey(key)
    setCatalogSortDir('asc')
  }

  function catalogSortProp(key: CatalogSortKey): SortDir | false {
    return catalogSortKey === key ? catalogSortDir : false
  }

  useEffect(() => {
    if (!menus?.length) {
      setSelectedMenuId(null)
      return
    }
    if (selectedMenuId && menus.some((m) => m.id === selectedMenuId)) return
    const live = menus.find((m) => m.is_live)
    setSelectedMenuId(live?.id ?? menus[0]!.id)
  }, [menus, selectedMenuId])

  useEffect(() => {
    setSelection(null)
  }, [selectedMenuId])

  const selectedMenu = menus?.find((m) => m.id === selectedMenuId) ?? null

  const menusByGroup = useMemo(() => {
    const list = menus ?? []
    const map = new Map<string | null, MenuRow[]>()
    for (const menu of list) {
      const key = menu.group_id
      const bucket = map.get(key) ?? []
      bucket.push(menu)
      map.set(key, bucket)
    }
    return map
  }, [menus])

  const flatMenus = useMemo(() => {
    return [...(menus ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, 'nb', { sensitivity: 'base' }),
    )
  }, [menus])

  function openInMenyTab(menuId?: string) {
    if (menuId) setSelectedMenuId(menuId)
    setDefaultActiveTab('Meny')
    setTabsKey((k) => k + 1)
  }

  const { data: tree, isPending: treePending } = useQuery({
    queryKey: ['admin', 'menu', selectedMenuId],
    enabled: !!selectedMenuId,
    queryFn: async (): Promise<{
      categories: MenuExplorerCategory[]
      items: MenuExplorerItem[]
    }> => {
      const { data, error } = await getSupabase()
        .from('menu_categories')
        .select(
          `id, menu_id, name, icon, sort_order, created_at,
           menu_items(
             id, category_id, catalog_item_id, price, is_sold_out, sort_order, created_at,
             menu_catalog_items(id, name, description, icon, default_price)
           )`,
        )
        .eq('menu_id', selectedMenuId!)
        .order('sort_order', { ascending: true })
        .order('sort_order', { ascending: true, referencedTable: 'menu_items' })

      if (error) throw error
      return flattenMenuTree((data ?? []) as MenuTreeRow[])
    },
  })

  const categories = tree?.categories ?? []
  const items = tree?.items ?? []

  const selectedCategory =
    selection?.type === 'category'
      ? categories.find((c) => c.id === selection.id) ?? null
      : null
  const selectedItem =
    selection?.type === 'item'
      ? items.find((i) => i.id === selection.id) ?? null
      : null

  const filteredCatalogForPicker = useMemo(() => {
    const list = catalogItems ?? []
    const q = itemCatalogFilter.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    )
  }, [catalogItems, itemCatalogFilter])

  const groupSelectOptions = useMemo(
    () => [
      { value: '', label: 'Uten gruppe' },
      ...(groups ?? []).map((g) => ({ value: g.id, label: g.name })),
    ],
    [groups],
  )

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'menus'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'menu-groups'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog-items'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'menu', selectedMenuId] })
    void queryClient.invalidateQueries({ queryKey: ['public', 'live-menu'] })
  }

  function openCreateMenu(prefillGroupId?: string | null) {
    setMenuEditingId(null)
    setMenuName('')
    setMenuGroupId(prefillGroupId ?? '')
    setMenuIcon(REACT95_MENU_ICON)
    setMenuDialogOpen(true)
  }

  function openEditMenu() {
    if (!selectedMenu) return
    setMenuEditingId(selectedMenu.id)
    setMenuName(selectedMenu.name)
    setMenuGroupId(selectedMenu.group_id ?? '')
    setMenuIcon(coerceIconValue(selectedMenu.icon, REACT95_MENU_ICON))
    setMenuDialogOpen(true)
  }

  function openCopyMenu() {
    if (!selectedMenu) return
    setCopyName(`${selectedMenu.name} (kopi)`)
    setCopyGroupId(selectedMenu.group_id ?? '')
    setCopyDialogOpen(true)
  }

  function openCreateGroup() {
    setGroupEditingId(null)
    setGroupName('')
    setGroupIcon(REACT95_FOLDER_ICON)
    setGroupSort(groups?.length ?? 0)
    setGroupDialogOpen(true)
  }

  function openEditGroup(group: MenuGroupRow) {
    setGroupEditingId(group.id)
    setGroupName(group.name)
    setGroupIcon(coerceIconValue(group.icon, REACT95_FOLDER_ICON))
    setGroupSort(group.sort_order)
    setGroupDialogOpen(true)
  }

  function openCreateCategory() {
    setCategoryEditingId(null)
    setCategoryName('')
    setCategorySort(categories.length)
    setCategoryIcon(REACT95_FOLDER_ICON)
    setCategoryDialogOpen(true)
  }

  function openEditCategory(category: MenuExplorerCategory) {
    setCategoryEditingId(category.id)
    setCategoryName(category.name)
    setCategorySort(category.sort_order)
    setCategoryIcon(coerceIconValue(category.icon, REACT95_FOLDER_ICON))
    setCategoryDialogOpen(true)
  }

  function openCreateItem(categoryId: string) {
    setItemEditingId(null)
    setItemCategoryId(categoryId)
    setItemCatalogId('')
    setItemCatalogFilter('')
    setItemPrice('')
    setItemSoldOut(false)
    const count = items.filter((i) => i.category_id === categoryId).length
    setItemSort(count)
    setItemDialogOpen(true)
  }

  function openEditItem(item: MenuExplorerItem) {
    setItemEditingId(item.id)
    setItemCategoryId(item.category_id)
    setItemCatalogId(item.catalog_item_id)
    setItemCatalogFilter('')
    setItemPrice(item.price)
    setItemSoldOut(item.is_sold_out)
    setItemSort(item.sort_order)
    setItemDialogOpen(true)
  }

  function openCreateCatalog() {
    setCatalogEditingId(null)
    setCatalogName('')
    setCatalogDescription('')
    setCatalogPrice('')
    setCatalogIcon(REACT95_DEFAULT_ICON)
    setCatalogSort(catalogItems?.length ?? 0)
    setCatalogDialogOpen(true)
  }

  function openEditCatalog(item: CatalogItemRow) {
    setCatalogEditingId(item.id)
    setCatalogName(item.name)
    setCatalogDescription(item.description)
    setCatalogPrice(item.default_price)
    setCatalogIcon(coerceIconValue(item.icon, REACT95_DEFAULT_ICON))
    setCatalogSort(item.sort_order)
    setCatalogDialogOpen(true)
  }

  function selectCatalogForPlacement(catalog: CatalogItemRow) {
    setItemCatalogId(catalog.id)
    if (!itemEditingId) {
      setItemPrice(catalog.default_price)
    }
  }

  const saveMenuMutation = useMutation({
    mutationFn: async () => {
      const name = menuName.trim()
      throwFieldErrors([!name && 'Fyll inn menynavn.'])
      const group_id = menuGroupId || null

      if (menuEditingId) {
        const patch: TablesUpdate<'menus'> = {
          name,
          group_id,
          icon: menuIcon,
        }
        const { error } = await getSupabase()
          .from('menus')
          .update(patch)
          .eq('id', menuEditingId)
        if (error) throw new Error(error.message)
        return menuEditingId
      }

      const insert: TablesInsert<'menus'> = {
        name,
        group_id,
        icon: menuIcon,
      }
      const { data, error } = await getSupabase()
        .from('menus')
        .insert(insert)
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return data.id
    },
    onSuccess: (id) => {
      invalidateAll()
      setSelectedMenuId(id)
      setMenuDialogOpen(false)
    },
  })

  const saveGroupMutation = useMutation({
    mutationFn: async () => {
      const name = groupName.trim()
      const sort = parseSort(groupSort)
      throwFieldErrors([
        !name && 'Fyll inn gruppenavn.',
        !Number.isFinite(sort) && 'Sortering må være et tall.',
      ])

      if (groupEditingId) {
        const patch: TablesUpdate<'menu_groups'> = {
          name,
          icon: groupIcon,
          sort_order: sort,
        }
        const { error } = await getSupabase()
          .from('menu_groups')
          .update(patch)
          .eq('id', groupEditingId)
        if (error) throw new Error(error.message)
        return
      }

      const insert: TablesInsert<'menu_groups'> = {
        name,
        icon: groupIcon,
        sort_order: sort,
      }
      const { error } = await getSupabase().from('menu_groups').insert(insert)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateAll()
      setGroupDialogOpen(false)
    },
  })

  const copyMenuMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMenu) throw new Error('Velg en meny først.')
      const name = copyName.trim() || undefined
      const groupId = copyGroupId || undefined
      const { data, error } = await getSupabase().rpc('admin_copy_menu', {
        p_menu_id: selectedMenu.id,
        ...(name ? { p_new_name: name } : {}),
        ...(groupId ? { p_group_id: groupId } : {}),
      })
      if (error) throw new Error(error.message)
      const parsed = (data ?? {}) as RpcStatusResponse
      if (parsed.status === 'forbidden') {
        throw new Error('Du har ikke tilgang til å kopiere menyer.')
      }
      if (parsed.status === 'not_authenticated') {
        throw new Error('Du må være innlogget.')
      }
      if (parsed.status === 'not_found') {
        throw new Error('Menyen ble ikke funnet.')
      }
      if (parsed.status === 'invalid_group') {
        throw new Error('Ugyldig menygruppe.')
      }
      if (parsed.status !== 'ok' || !parsed.menu_id) {
        throw new Error('Kunne ikke kopiere menyen.')
      }
      return parsed.menu_id
    },
    onSuccess: (id) => {
      invalidateAll()
      setSelectedMenuId(id)
      setCopyDialogOpen(false)
    },
  })

  const setLiveMutation = useMutation({
    mutationFn: async (menuId: string) => {
      const { data, error } = await getSupabase().rpc('admin_set_menu_live', {
        p_menu_id: menuId,
      })
      if (error) throw new Error(error.message)
      const parsed = (data ?? {}) as RpcStatusResponse
      if (parsed.status === 'forbidden') {
        throw new Error('Du har ikke tilgang til å sette live-meny.')
      }
      if (parsed.status === 'not_authenticated') {
        throw new Error('Du må være innlogget.')
      }
      if (parsed.status === 'not_found') {
        throw new Error('Menyen ble ikke funnet.')
      }
      if (parsed.status !== 'ok') {
        throw new Error('Kunne ikke sette menyen som live.')
      }
    },
    onSuccess: () => {
      invalidateAll()
    },
  })

  const deleteMenuMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('menus').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateAll()
      setMenuToDelete(null)
      setSelectedMenuId(null)
    },
  })

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('menu_groups').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateAll()
      setGroupToDelete(null)
    },
  })

  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      const name = categoryName.trim()
      const sort = parseSort(categorySort)
      throwFieldErrors([
        !selectedMenuId && 'Velg en meny først.',
        !name && 'Fyll inn mappenavn.',
        !Number.isFinite(sort) && 'Sortering må være et tall.',
      ])

      if (categoryEditingId) {
        const patch: TablesUpdate<'menu_categories'> = {
          name,
          sort_order: sort,
          icon: categoryIcon,
        }
        const { error } = await getSupabase()
          .from('menu_categories')
          .update(patch)
          .eq('id', categoryEditingId)
        if (error) throw new Error(error.message)
        return
      }

      const insert: TablesInsert<'menu_categories'> = {
        menu_id: selectedMenuId!,
        name,
        sort_order: sort,
        icon: categoryIcon,
      }
      const { error } = await getSupabase().from('menu_categories').insert(insert)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateAll()
      setCategoryDialogOpen(false)
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('menu_categories').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateAll()
      setCategoryToDelete(null)
      setSelection(null)
    },
  })

  const saveItemMutation = useMutation({
    mutationFn: async () => {
      const price = parsePrice(itemPrice)
      const sort = parseSort(itemSort)
      throwFieldErrors([
        !itemCategoryId && 'Mangler kategori.',
        !itemCatalogId && 'Velg en vare fra varebanken.',
        (!Number.isFinite(price) || price < 0) &&
          'Oppgi en gyldig pris (0 eller mer).',
        !Number.isFinite(sort) && 'Sortering må være et tall.',
      ])

      if (itemEditingId) {
        const patch: TablesUpdate<'menu_items'> = {
          catalog_item_id: itemCatalogId,
          price,
          is_sold_out: itemSoldOut,
          sort_order: sort,
        }
        const { error } = await getSupabase()
          .from('menu_items')
          .update(patch)
          .eq('id', itemEditingId)
        if (error) throw new Error(error.message)
        return
      }

      const insert: TablesInsert<'menu_items'> = {
        category_id: itemCategoryId!,
        catalog_item_id: itemCatalogId,
        price,
        is_sold_out: itemSoldOut,
        sort_order: sort,
      }
      const { error } = await getSupabase().from('menu_items').insert(insert)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateAll()
      setItemDialogOpen(false)
    },
  })

  const toggleSoldOutMutation = useMutation({
    mutationFn: async ({ id, is_sold_out }: { id: string; is_sold_out: boolean }) => {
      const { error } = await getSupabase()
        .from('menu_items')
        .update({ is_sold_out })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateAll()
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('menu_items').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateAll()
      setItemToDelete(null)
      setSelection(null)
    },
  })

  const saveCatalogMutation = useMutation({
    mutationFn: async () => {
      const name = catalogName.trim()
      const price = parsePrice(catalogPrice)
      const sort = parseSort(catalogSort)
      throwFieldErrors([
        !name && 'Fyll inn varenavn.',
        (!Number.isFinite(price) || price < 0) &&
          'Oppgi en gyldig standardpris (0 eller mer).',
        !Number.isFinite(sort) && 'Sortering må være et tall.',
      ])

      if (catalogEditingId) {
        const patch: TablesUpdate<'menu_catalog_items'> = {
          name,
          description: catalogDescription.trim(),
          default_price: price,
          icon: catalogIcon,
          sort_order: sort,
        }
        const { error } = await getSupabase()
          .from('menu_catalog_items')
          .update(patch)
          .eq('id', catalogEditingId)
        if (error) throw new Error(error.message)
        return
      }

      const insert: TablesInsert<'menu_catalog_items'> = {
        name,
        description: catalogDescription.trim(),
        default_price: price,
        icon: catalogIcon,
        sort_order: sort,
      }
      const { error } = await getSupabase().from('menu_catalog_items').insert(insert)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateAll()
      setCatalogDialogOpen(false)
    },
  })

  const deleteCatalogMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from('menu_catalog_items')
        .delete()
        .eq('id', id)
      if (error) {
        if (error.code === '23503') {
          throw new Error(
            'Varen er i bruk på én eller flere menyer. Fjern den fra menyene først.',
          )
        }
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      invalidateAll()
      setCatalogToDelete(null)
    },
  })

  const mutationError =
    saveMenuMutation.error ??
    saveGroupMutation.error ??
    copyMenuMutation.error ??
    setLiveMutation.error ??
    deleteMenuMutation.error ??
    deleteGroupMutation.error ??
    saveCategoryMutation.error ??
    deleteCategoryMutation.error ??
    saveItemMutation.error ??
    toggleSoldOutMutation.error ??
    deleteItemMutation.error ??
    saveCatalogMutation.error ??
    deleteCatalogMutation.error

  return (
    <Frame
      display="flex"
      flexDirection="column"
      gap="$3"
      height="100%"
      style={{ minHeight: 0 }}
    >
      <h2 style={{ margin: 0, fontSize: 18, flexShrink: 0 }}>Meny</h2>
      <p
        className="win95-muted"
        style={{ margin: 0, fontSize: 13, flexShrink: 0 }}
      >
        Organiser grupper, bygg menyer i arbeidsflaten, og hold varebanken oppdatert.
        Sett én meny som live for kundene.
      </p>

      <Frame
        className="win95-menu-tabs-shell"
        display="flex"
        flexDirection="column"
        height="100%"
        style={{ minHeight: 0, flex: 1 }}
      >
      <Tabs
        key={tabsKey}
        className="win95-menu-tabs"
        defaultActiveTab={defaultActiveTab}
      >
        <Tab title="Meny">
          <Frame display="flex" flexDirection="column" gap="$3" pt="$3" style={{ minHeight: 0 }}>
            <Frame
              display="flex"
              flexWrap="wrap"
              gap="$2"
              alignItems="center"
              justifyContent="space-between"
              style={{ flexShrink: 0 }}
            >
              <Frame display="flex" flexWrap="wrap" gap="$2" alignItems="center">
                <Button onClick={() => openCreateMenu()}>Ny meny</Button>
                <Button disabled={!selectedMenu} onClick={openEditMenu}>
                  Rediger meny
                </Button>
                <Button disabled={!selectedMenu} onClick={openCopyMenu}>
                  Kopier meny
                </Button>
                <Button
                  disabled={
                    !selectedMenu || selectedMenu.is_live || setLiveMutation.isPending
                  }
                  onClick={() =>
                    selectedMenu && setLiveMutation.mutate(selectedMenu.id)
                  }
                >
                  {setLiveMutation.isPending ? 'Setter…' : 'Sett som live'}
                </Button>
                <Button
                  disabled={!selectedMenu}
                  onClick={() => selectedMenu && setMenuToDelete(selectedMenu)}
                >
                  Slett meny
                </Button>
                <Button disabled={!selectedMenu} onClick={openCreateCategory}>
                  Ny mappe
                </Button>
              </Frame>
              {selectedMenu?.is_live ? (
                <span className="win95-menu-live-badge" aria-label="Denne menyen er live">
                  LIVE
                </span>
              ) : null}
            </Frame>

            <div className="win95-menu-admin-layout">
              <Frame
                className="win95-menu-admin-layout__meny-list"
                bgColor="canvas"
                p="$2"
              >
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 'bold' }}>
                  Menyer
                </p>
                {menusPending ? (
                  <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
                    Laster…
                  </p>
                ) : flatMenus.length === 0 ? (
                  <p className="win95-muted" style={{ margin: 0, fontSize: 11 }}>
                    Ingen menyer ennå. Klikk «Ny meny» for å starte.
                  </p>
                ) : (
                  <Frame display="flex" flexDirection="column" gap="$1">
                    {flatMenus.map((menu) => (
                      <button
                        key={menu.id}
                        type="button"
                        className="win95-menu-admin-layout__menu-btn"
                        aria-pressed={selectedMenuId === menu.id}
                        aria-label={
                          menu.is_live ? `${menu.name} (live)` : menu.name
                        }
                        onClick={() => setSelectedMenuId(menu.id)}
                      >
                        <React95Icon
                          icon={menu.icon}
                          size={16}
                          fallback={REACT95_MENU_ICON}
                        />
                        <span className="win95-menu-admin-layout__menu-btn-label">
                          {menu.name}
                        </span>
                        {menu.is_live ? (
                          <span
                            className="win95-menu-live-dot"
                            title="Live"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    ))}
                  </Frame>
                )}
              </Frame>

              <div className="win95-menu-admin-layout__editor">
                {!selectedMenuId ? (
                  <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
                    {menusPending
                      ? 'Laster menyer…'
                      : 'Opprett en meny eller velg en fra listen til venstre.'}
                  </p>
                ) : treePending ? (
                  <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
                    Laster innhold…
                  </p>
                ) : (
                  <MenuExplorer
                    rootLabel={selectedMenu?.name ?? 'Meny'}
                    rootIcon={selectedMenu?.icon}
                    categories={categories}
                    items={items}
                    selection={selection}
                    onSelect={setSelection}
                    emptyMessage="Ingen mapper ennå. Klikk «Ny mappe» for å legge til."
                  >
                    {selectedCategory ? (
                      <Frame display="flex" flexDirection="column" gap="$3">
                        <div>
                          <div className="win95-menu-explorer__detail-heading">
                            <React95Icon
                              icon={selectedCategory.icon}
                              size={48}
                              fallback={REACT95_FOLDER_ICON}
                            />
                            <strong style={{ fontSize: 15 }}>
                              {selectedCategory.name}
                            </strong>
                          </div>
                          <p
                            className="win95-muted"
                            style={{ margin: '4px 0 0', fontSize: 12 }}
                          >
                            Mappe · sortering {selectedCategory.sort_order}
                          </p>
                        </div>
                        <Frame
                          className="win95-menu-explorer__detail-actions"
                          display="flex"
                          flexDirection="row"
                          flexWrap="nowrap"
                          gap="$4"
                          alignItems="center"
                        >
                          <Win95IconButton
                            label="Legg til vare"
                            onClick={() => openCreateItem(selectedCategory.id)}
                          >
                            <New16
                              variant="16x16_4"
                              width={32}
                              height={32}
                            />
                          </Win95IconButton>
                          <Win95IconButton
                            label="Rediger mappe"
                            onClick={() => openEditCategory(selectedCategory)}
                          >
                            <FilePen
                              variant="32x32_4"
                              width={32}
                              height={32}
                            />
                          </Win95IconButton>
                          <Win95IconButton
                            label="Slett mappe"
                            onClick={() =>
                              setCategoryToDelete(selectedCategory)
                            }
                          >
                            <Delete
                              variant="16x16_4"
                              width={32}
                              height={32}
                            />
                          </Win95IconButton>
                        </Frame>
                      </Frame>
                    ) : null}

                    {selectedItem ? (
                      <Frame display="flex" flexDirection="column" gap="$3">
                        <div>
                          <div className="win95-menu-explorer__detail-heading">
                            <React95Icon icon={selectedItem.icon} size={48} />
                            <strong
                              className={
                                selectedItem.is_sold_out
                                  ? 'win95-menu-sold-out'
                                  : undefined
                              }
                              style={{ fontSize: 15 }}
                            >
                              {selectedItem.name}
                            </strong>
                          </div>
                          <p
                            style={{
                              margin: '6px 0 0',
                              fontSize: 14,
                              fontWeight: 'bold',
                            }}
                          >
                            {formatMenuPrice(selectedItem.price)}
                          </p>
                          {selectedItem.description ? (
                            <p
                              style={{
                                margin: '8px 0 0',
                                fontSize: 13,
                                lineHeight: 1.45,
                              }}
                            >
                              {selectedItem.description}
                            </p>
                          ) : (
                            <p
                              className="win95-muted"
                              style={{ margin: '8px 0 0', fontSize: 12 }}
                            >
                              Ingen beskrivelse.
                            </p>
                          )}
                          {selectedItem.is_sold_out ? (
                            <p
                              style={{
                                margin: '8px 0 0',
                                fontSize: 13,
                                color: '#c00000',
                              }}
                            >
                              Utsolgt
                            </p>
                          ) : null}
                        </div>
                        <Frame
                          className="win95-menu-explorer__detail-actions"
                          display="flex"
                          flexDirection="row"
                          flexWrap="nowrap"
                          gap="$4"
                          alignItems="center"
                        >
                          <Button
                            disabled={toggleSoldOutMutation.isPending}
                            onClick={() =>
                              toggleSoldOutMutation.mutate({
                                id: selectedItem.id,
                                is_sold_out: !selectedItem.is_sold_out,
                              })
                            }
                          >
                            {selectedItem.is_sold_out
                              ? 'Marker som tilgjengelig'
                              : 'Marker som utsolgt'}
                          </Button>
                          <Win95IconButton
                            label="Rediger"
                            onClick={() => openEditItem(selectedItem)}
                          >
                            <FilePen
                              variant="32x32_4"
                              width={32}
                              height={32}
                            />
                          </Win95IconButton>
                          <Win95IconButton
                            label="Fjern fra meny"
                            onClick={() => setItemToDelete(selectedItem)}
                          >
                            <Delete
                              variant="16x16_4"
                              width={32}
                              height={32}
                            />
                          </Win95IconButton>
                        </Frame>
                      </Frame>
                    ) : null}
                  </MenuExplorer>
                )}
              </div>
            </div>
          </Frame>
        </Tab>

        <Tab title="Grupper">
          <Frame display="flex" flexDirection="column" gap="$3" pt="$3" style={{ minHeight: 0 }}>
            <Frame
              display="flex"
              flexWrap="wrap"
              gap="$2"
              alignItems="center"
              style={{ flexShrink: 0 }}
            >
              <Button onClick={openCreateGroup}>Ny gruppe</Button>
              <Button
                disabled={!selectedMenu}
                onClick={() => selectedMenu && openInMenyTab(selectedMenu.id)}
              >
                Åpne i Meny
              </Button>
              <span className="win95-muted" style={{ fontSize: 12 }}>
                {selectedMenu
                  ? `Valgt: ${selectedMenu.name}${selectedMenu.is_live ? ' (live)' : ''}`
                  : 'Velg en meny for forhåndsvisning'}
              </span>
            </Frame>

            <div className="win95-menu-admin-layout">
              <Frame
                className="win95-menu-admin-layout__groups"
                bgColor="canvas"
                p="$2"
              >
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 'bold' }}>
                  Grupper
                </p>
                {groupsPending || menusPending ? (
                  <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
                    Laster…
                  </p>
                ) : (
                  <Frame display="flex" flexDirection="column" gap="$2">
                    {(groups ?? []).map((group) => {
                      const groupMenus = menusByGroup.get(group.id) ?? []
                      return (
                        <div key={group.id}>
                          <div className="win95-menu-admin-layout__group-row">
                            <React95Icon
                              icon={group.icon}
                              size={16}
                              fallback={REACT95_FOLDER_ICON}
                            />
                            <strong
                              style={{ fontSize: 12, flex: 1, minWidth: 0 }}
                            >
                              {group.name}
                            </strong>
                            <Button
                              onClick={() => openEditGroup(group)}
                              aria-label={`Rediger ${group.name}`}
                            >
                              …
                            </Button>
                            <Button
                              onClick={() => setGroupToDelete(group)}
                              aria-label={`Slett ${group.name}`}
                            >
                              ×
                            </Button>
                          </div>
                          {groupMenus.length === 0 ? (
                            <p
                              className="win95-muted"
                              style={{ margin: '0 0 0 20px', fontSize: 11 }}
                            >
                              Ingen menyer
                            </p>
                          ) : (
                            <Frame
                              display="flex"
                              flexDirection="column"
                              gap="$1"
                              style={{ marginLeft: 12 }}
                            >
                              {groupMenus.map((menu) => (
                                <button
                                  key={menu.id}
                                  type="button"
                                  className="win95-menu-admin-layout__menu-btn"
                                  aria-pressed={selectedMenuId === menu.id}
                                  onClick={() => setSelectedMenuId(menu.id)}
                                >
                                  <React95Icon
                                    icon={menu.icon}
                                    size={16}
                                    fallback={REACT95_MENU_ICON}
                                  />
                                  <span>
                                    {menu.name}
                                    {menu.is_live ? ' (live)' : ''}
                                  </span>
                                </button>
                              ))}
                            </Frame>
                          )}
                        </div>
                      )
                    })}

                    <div>
                      <p
                        style={{
                          margin: '4px 0',
                          fontSize: 12,
                          fontWeight: 'bold',
                        }}
                      >
                        Uten gruppe
                      </p>
                      {(menusByGroup.get(null) ?? []).length === 0 ? (
                        <p
                          className="win95-muted"
                          style={{ margin: 0, fontSize: 11 }}
                        >
                          Ingen menyer
                        </p>
                      ) : (
                        <Frame display="flex" flexDirection="column" gap="$1">
                          {(menusByGroup.get(null) ?? []).map((menu) => (
                            <button
                              key={menu.id}
                              type="button"
                              className="win95-menu-admin-layout__menu-btn"
                              aria-pressed={selectedMenuId === menu.id}
                              onClick={() => setSelectedMenuId(menu.id)}
                            >
                              <React95Icon
                                icon={menu.icon}
                                size={16}
                                fallback={REACT95_MENU_ICON}
                              />
                              <span>
                                {menu.name}
                                {menu.is_live ? ' (live)' : ''}
                              </span>
                            </button>
                          ))}
                        </Frame>
                      )}
                    </div>
                  </Frame>
                )}
              </Frame>

              <div className="win95-menu-admin-layout__editor">
                {!selectedMenuId ? (
                  <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
                    {menusPending
                      ? 'Laster menyer…'
                      : 'Velg en meny i listen for å forhåndsvise innholdet.'}
                  </p>
                ) : treePending ? (
                  <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
                    Laster innhold…
                  </p>
                ) : (
                  <MenuExplorer
                    rootLabel={selectedMenu?.name ?? 'Meny'}
                    rootIcon={selectedMenu?.icon}
                    categories={categories}
                    items={items}
                    selection={selection}
                    onSelect={setSelection}
                    emptyMessage="Denne menyen har ingen mapper ennå."
                    detailLegend="Forhåndsvisning"
                  >
                    {selectedCategory ? (
                      <Frame display="flex" flexDirection="column" gap="$2">
                        <div className="win95-menu-explorer__detail-heading">
                          <React95Icon
                            icon={selectedCategory.icon}
                            size={48}
                            fallback={REACT95_FOLDER_ICON}
                          />
                          <strong style={{ fontSize: 15 }}>
                            {selectedCategory.name}
                          </strong>
                        </div>
                        <p
                          className="win95-muted"
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          Mappe · sortering {selectedCategory.sort_order}
                        </p>
                        <p
                          className="win95-muted"
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          Kun forhåndsvisning. Bruk «Åpne i Meny» for å redigere.
                        </p>
                      </Frame>
                    ) : null}

                    {selectedItem ? (
                      <Frame display="flex" flexDirection="column" gap="$2">
                        <div className="win95-menu-explorer__detail-heading">
                          <React95Icon icon={selectedItem.icon} size={48} />
                          <strong
                            className={
                              selectedItem.is_sold_out
                                ? 'win95-menu-sold-out'
                                : undefined
                            }
                            style={{ fontSize: 15 }}
                          >
                            {selectedItem.name}
                          </strong>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 'bold',
                          }}
                        >
                          {formatMenuPrice(selectedItem.price)}
                        </p>
                        {selectedItem.description ? (
                          <p
                            style={{
                              margin: 0,
                              fontSize: 13,
                              lineHeight: 1.45,
                            }}
                          >
                            {selectedItem.description}
                          </p>
                        ) : (
                          <p
                            className="win95-muted"
                            style={{ margin: 0, fontSize: 12 }}
                          >
                            Ingen beskrivelse.
                          </p>
                        )}
                        {selectedItem.is_sold_out ? (
                          <p
                            style={{
                              margin: 0,
                              fontSize: 13,
                              color: '#c00000',
                            }}
                          >
                            Utsolgt
                          </p>
                        ) : null}
                        <p
                          className="win95-muted"
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          Kun forhåndsvisning. Bruk «Åpne i Meny» for å redigere.
                        </p>
                      </Frame>
                    ) : null}
                  </MenuExplorer>
                )}
              </div>
            </div>
          </Frame>
        </Tab>

        <Tab title="Varebank">
          <Frame display="flex" flexDirection="column" gap="$3" pt="$3">
            <Frame display="flex" flexWrap="wrap" gap="$2" alignItems="center">
              <Button onClick={openCreateCatalog}>Ny vare</Button>
              <span className="win95-muted" style={{ fontSize: 12 }}>
                {catalogPending
                  ? 'Laster…'
                  : `${catalogRows.length} varer i banken`}
              </span>
            </Frame>
            <Table minWidth={560}>
              <TableHead>
                <TableRow>
                  <TableHeadCell style={{ width: 48 }}>Ikon</TableHeadCell>
                  <TableHeadCell
                    sort={catalogSortProp('name')}
                    onClick={() => toggleCatalogSort('name')}
                  >
                    Navn
                  </TableHeadCell>
                  <TableHeadCell
                    sort={catalogSortProp('default_price')}
                    onClick={() => toggleCatalogSort('default_price')}
                    style={{ width: 110 }}
                  >
                    Standardpris
                  </TableHeadCell>
                  <TableHeadCell
                    sort={catalogSortProp('sort_order')}
                    onClick={() => toggleCatalogSort('sort_order')}
                    style={{ width: 90 }}
                  >
                    Sortering
                  </TableHeadCell>
                  <TableHeadCell style={{ width: 112 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {catalogPending ? (
                  <TableRow>
                    <TableDataCell colSpan={CATALOG_COL_COUNT}>
                      Laster…
                    </TableDataCell>
                  </TableRow>
                ) : null}
                {!catalogPending && catalogRows.length === 0 ? (
                  <TableRow>
                    <TableDataCell
                      colSpan={CATALOG_COL_COUNT}
                      className="win95-muted"
                    >
                      Ingen varer ennå. Opprett varer her, og plukk dem inn i
                      menyer etterpå.
                    </TableDataCell>
                  </TableRow>
                ) : null}
                {!catalogPending
                  ? catalogRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableDataCell>
                          <React95Icon icon={row.icon} size={32} />
                        </TableDataCell>
                        <TableDataCell>{row.name}</TableDataCell>
                        <TableDataCell>
                          {formatMenuPrice(row.default_price)}
                        </TableDataCell>
                        <TableDataCell>{row.sort_order}</TableDataCell>
                        <TableDataCell>
                          <Frame
                            display="flex"
                            gap="$4"
                            justifyContent="flex-end"
                          >
                            <Win95IconButton
                              label="Rediger"
                              onClick={() => openEditCatalog(row)}
                            >
                              <FilePen
                                variant="32x32_4"
                                width={32}
                                height={32}
                              />
                            </Win95IconButton>
                            <Win95IconButton
                              label="Slett"
                              onClick={() => setCatalogToDelete(row)}
                            >
                              <Delete
                                variant="16x16_4"
                                width={32}
                                height={32}
                              />
                            </Win95IconButton>
                          </Frame>
                        </TableDataCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          </Frame>
        </Tab>
      </Tabs>
      </Frame>

      {mutationError ? (
        <p style={{ margin: 0, color: '#c00000', fontSize: 13 }}>
          {mutationError instanceof Error ? mutationError.message : 'Noe gikk galt.'}
        </p>
      ) : null}

      {/* Menu dialog */}
      <Win95Dialog
        open={menuDialogOpen}
        onClose={() => {
          setMenuDialogOpen(false)
          saveMenuMutation.reset()
        }}
        title={menuEditingId ? 'Rediger meny' : 'Ny meny'}
        width="720px"
        minHeight="320px"
      >
        <div className="win95-dialog-form-with-icon">
          <div className="win95-dialog-form-with-icon__fields">
            <div className="win95-field">
              <label htmlFor="menu-name">Navn</label>
              <Input
                id="menu-name"
                value={menuName}
                onChange={(e) => setMenuName(e.currentTarget.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="win95-field" style={{ marginTop: 8 }}>
              <label htmlFor="menu-group">Gruppe</label>
              <Win95Select
                id="menu-group"
                options={groupSelectOptions}
                value={menuGroupId}
                onChange={setMenuGroupId}
              />
            </div>
          </div>
          <div className="win95-dialog-form-with-icon__icon">
            <React95IconPicker
              value={menuIcon}
              onChange={setMenuIcon}
              labelId="menu-icon-label"
              defaultIcon={REACT95_MENU_ICON}
            />
          </div>
        </div>
        {saveMenuMutation.isError ? (
          <p className="win95-dialog-field-error" role="alert">
            {dialogErrorMessage(saveMenuMutation.error)}
          </p>
        ) : null}
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button
            onClick={() => {
              setMenuDialogOpen(false)
              saveMenuMutation.reset()
            }}
          >
            Avbryt
          </Button>
          <Button
            disabled={saveMenuMutation.isPending}
            onClick={() => saveMenuMutation.mutate()}
          >
            {saveMenuMutation.isPending ? 'Lagrer…' : 'Lagre'}
          </Button>
        </Frame>
      </Win95Dialog>

      {/* Group dialog */}
      <Win95Dialog
        open={groupDialogOpen}
        onClose={() => {
          setGroupDialogOpen(false)
          saveGroupMutation.reset()
        }}
        title={groupEditingId ? 'Rediger gruppe' : 'Ny gruppe'}
        width="720px"
        minHeight="300px"
      >
        <div className="win95-dialog-form-with-icon">
          <div className="win95-dialog-form-with-icon__fields">
            <div className="win95-field">
              <label htmlFor="group-name">Navn</label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.currentTarget.value)}
                placeholder="f.eks. Summercamp"
                style={{ width: '100%' }}
              />
            </div>
            <div className="win95-field" style={{ marginTop: 8 }}>
              <label htmlFor="group-sort">Sortering</label>
              <Input
                id="group-sort"
                type="number"
                value={String(groupSort)}
                onChange={(e) => setGroupSort(e.currentTarget.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div className="win95-dialog-form-with-icon__icon">
            <React95IconPicker
              value={groupIcon}
              onChange={setGroupIcon}
              labelId="group-icon-label"
              defaultIcon={REACT95_FOLDER_ICON}
            />
          </div>
        </div>
        {saveGroupMutation.isError ? (
          <p className="win95-dialog-field-error" role="alert">
            {dialogErrorMessage(saveGroupMutation.error)}
          </p>
        ) : null}
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button
            onClick={() => {
              setGroupDialogOpen(false)
              saveGroupMutation.reset()
            }}
          >
            Avbryt
          </Button>
          <Button
            disabled={saveGroupMutation.isPending}
            onClick={() => saveGroupMutation.mutate()}
          >
            {saveGroupMutation.isPending ? 'Lagrer…' : 'Lagre'}
          </Button>
        </Frame>
      </Win95Dialog>

      {/* Copy dialog */}
      <Win95Dialog
        open={copyDialogOpen}
        onClose={() => {
          setCopyDialogOpen(false)
          copyMenuMutation.reset()
        }}
        title="Kopier meny"
        width="400px"
        minHeight="200px"
      >
        <div className="win95-field">
          <label htmlFor="copy-name">Nytt navn</label>
          <Input
            id="copy-name"
            value={copyName}
            onChange={(e) => setCopyName(e.currentTarget.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="win95-field" style={{ marginTop: 8 }}>
          <label htmlFor="copy-group">Gruppe</label>
          <Win95Select
            id="copy-group"
            options={groupSelectOptions}
            value={copyGroupId}
            onChange={setCopyGroupId}
          />
        </div>
        {copyMenuMutation.isError ? (
          <p className="win95-dialog-field-error" role="alert">
            {dialogErrorMessage(copyMenuMutation.error)}
          </p>
        ) : null}
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button
            onClick={() => {
              setCopyDialogOpen(false)
              copyMenuMutation.reset()
            }}
          >
            Avbryt
          </Button>
          <Button
            disabled={copyMenuMutation.isPending}
            onClick={() => copyMenuMutation.mutate()}
          >
            {copyMenuMutation.isPending ? 'Kopierer…' : 'Kopier'}
          </Button>
        </Frame>
      </Win95Dialog>

      {/* Category dialog */}
      <Win95Dialog
        open={categoryDialogOpen}
        onClose={() => {
          setCategoryDialogOpen(false)
          saveCategoryMutation.reset()
        }}
        title={categoryEditingId ? 'Rediger mappe' : 'Ny mappe'}
        width="720px"
        minHeight="320px"
      >
        <div className="win95-dialog-form-with-icon">
          <div className="win95-dialog-form-with-icon__fields">
            <div className="win95-field">
              <label htmlFor="category-name">Navn</label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.currentTarget.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="win95-field" style={{ marginTop: 8 }}>
              <label htmlFor="category-sort">Sortering</label>
              <Input
                id="category-sort"
                type="number"
                value={String(categorySort)}
                onChange={(e) => setCategorySort(e.currentTarget.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div className="win95-dialog-form-with-icon__icon">
            <React95IconPicker
              value={categoryIcon}
              onChange={setCategoryIcon}
              labelId="category-icon-label"
              defaultIcon={REACT95_FOLDER_ICON}
            />
          </div>
        </div>
        {saveCategoryMutation.isError ? (
          <p className="win95-dialog-field-error" role="alert">
            {dialogErrorMessage(saveCategoryMutation.error)}
          </p>
        ) : null}
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button
            onClick={() => {
              setCategoryDialogOpen(false)
              saveCategoryMutation.reset()
            }}
          >
            Avbryt
          </Button>
          <Button
            disabled={saveCategoryMutation.isPending}
            onClick={() => saveCategoryMutation.mutate()}
          >
            {saveCategoryMutation.isPending ? 'Lagrer…' : 'Lagre'}
          </Button>
        </Frame>
      </Win95Dialog>

      {/* Placement dialog */}
      <Win95Dialog
        open={itemDialogOpen}
        onClose={() => {
          setItemDialogOpen(false)
          saveItemMutation.reset()
        }}
        title={itemEditingId ? 'Rediger plassering' : 'Legg til vare'}
        width="440px"
        minHeight="420px"
      >
        <div className="win95-field">
          <label htmlFor="item-catalog-filter">Velg vare fra banken</label>
          <Input
            id="item-catalog-filter"
            value={itemCatalogFilter}
            onChange={(e) => setItemCatalogFilter(e.currentTarget.value)}
            placeholder="Søk vare…"
            style={{ width: '100%', marginBottom: 4 }}
          />
          <div className="win95-catalog-picker">
            {filteredCatalogForPicker.length === 0 ? (
              <p className="win95-muted" style={{ margin: 4, fontSize: 12 }}>
                {(catalogItems?.length ?? 0) === 0
                  ? 'Varebanken er tom. Opprett varer under fanen Varebank.'
                  : 'Ingen varer matcher søket.'}
              </p>
            ) : (
              filteredCatalogForPicker.map((catalog) => (
                <button
                  key={catalog.id}
                  type="button"
                  className="win95-catalog-picker__option"
                  aria-pressed={itemCatalogId === catalog.id}
                  onClick={() => selectCatalogForPlacement(catalog)}
                >
                  <React95Icon icon={catalog.icon} size={20} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{catalog.name}</span>
                  <span className="win95-muted" style={{ fontSize: 11 }}>
                    {formatMenuPrice(catalog.default_price)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="win95-field" style={{ marginTop: 8 }}>
          <label htmlFor="item-price">Pris på denne menyen (kr)</label>
          <Input
            id="item-price"
            value={String(itemPrice)}
            onChange={(e) => setItemPrice(e.currentTarget.value)}
            placeholder="f.eks. 45"
            style={{ width: '100%' }}
          />
        </div>
        <div className="win95-field" style={{ marginTop: 8 }}>
          <label htmlFor="item-sort">Sortering</label>
          <Input
            id="item-sort"
            type="number"
            value={String(itemSort)}
            onChange={(e) => setItemSort(e.currentTarget.value)}
            style={{ width: '100%' }}
          />
        </div>
        <Checkbox
          className="win95-checkbox-lg"
          checked={itemSoldOut}
          onChange={() => setItemSoldOut((prev) => !prev)}
        >
          Utsolgt
        </Checkbox>
        {saveItemMutation.isError ? (
          <p className="win95-dialog-field-error" role="alert">
            {dialogErrorMessage(saveItemMutation.error)}
          </p>
        ) : null}
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button
            onClick={() => {
              setItemDialogOpen(false)
              saveItemMutation.reset()
            }}
          >
            Avbryt
          </Button>
          <Button
            disabled={saveItemMutation.isPending}
            onClick={() => saveItemMutation.mutate()}
          >
            {saveItemMutation.isPending ? 'Lagrer…' : 'Lagre'}
          </Button>
        </Frame>
      </Win95Dialog>

      {/* Catalog dialog */}
      <Win95Dialog
        open={catalogDialogOpen}
        onClose={() => {
          setCatalogDialogOpen(false)
          saveCatalogMutation.reset()
        }}
        title={catalogEditingId ? 'Rediger vare' : 'Ny vare'}
        width="720px"
        minHeight="360px"
      >
        <div className="win95-dialog-form-with-icon">
          <div className="win95-dialog-form-with-icon__fields">
            <div className="win95-field">
              <label htmlFor="catalog-name">Navn</label>
              <Input
                id="catalog-name"
                value={catalogName}
                onChange={(e) => setCatalogName(e.currentTarget.value)}
                placeholder="f.eks. Cappuccino"
                style={{ width: '100%' }}
              />
            </div>
            <div className="win95-field" style={{ marginTop: 8 }}>
              <label htmlFor="catalog-price">Standardpris (kr)</label>
              <Input
                id="catalog-price"
                value={String(catalogPrice)}
                onChange={(e) => setCatalogPrice(e.currentTarget.value)}
                placeholder="f.eks. 45"
                style={{ width: '100%' }}
              />
            </div>
            <div className="win95-field" style={{ marginTop: 8 }}>
              <label htmlFor="catalog-description">Beskrivelse</label>
              <Input
                id="catalog-description"
                value={catalogDescription}
                onChange={(e) => setCatalogDescription(e.currentTarget.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="win95-field" style={{ marginTop: 8 }}>
              <label htmlFor="catalog-sort">Sortering</label>
              <Input
                id="catalog-sort"
                type="number"
                value={String(catalogSort)}
                onChange={(e) => setCatalogSort(e.currentTarget.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div className="win95-dialog-form-with-icon__icon">
            <React95IconPicker
              value={catalogIcon}
              onChange={setCatalogIcon}
              labelId="catalog-icon-label"
              defaultIcon={REACT95_DEFAULT_ICON}
            />
          </div>
        </div>
        {saveCatalogMutation.isError ? (
          <p className="win95-dialog-field-error" role="alert">
            {dialogErrorMessage(saveCatalogMutation.error)}
          </p>
        ) : null}
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button
            onClick={() => {
              setCatalogDialogOpen(false)
              saveCatalogMutation.reset()
            }}
          >
            Avbryt
          </Button>
          <Button
            disabled={saveCatalogMutation.isPending}
            onClick={() => saveCatalogMutation.mutate()}
          >
            {saveCatalogMutation.isPending ? 'Lagrer…' : 'Lagre'}
          </Button>
        </Frame>
      </Win95Dialog>

      {/* Delete confirms */}
      <Win95Dialog
        open={!!menuToDelete}
        onClose={() => setMenuToDelete(null)}
        title="Slett meny"
        width="360px"
        minHeight="140px"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Slette menyen <strong>{menuToDelete?.name}</strong>? Mapper og plasseringer
          slettes. Varebanken beholdes.
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setMenuToDelete(null)}>Avbryt</Button>
          <Button
            disabled={deleteMenuMutation.isPending}
            onClick={() => menuToDelete && deleteMenuMutation.mutate(menuToDelete.id)}
          >
            {deleteMenuMutation.isPending ? 'Sletter…' : 'Slett'}
          </Button>
        </Frame>
      </Win95Dialog>

      <Win95Dialog
        open={!!groupToDelete}
        onClose={() => setGroupToDelete(null)}
        title="Slett gruppe"
        width="360px"
        minHeight="140px"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Slette gruppen <strong>{groupToDelete?.name}</strong>? Menyene i gruppen blir
          stående uten gruppe.
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setGroupToDelete(null)}>Avbryt</Button>
          <Button
            disabled={deleteGroupMutation.isPending}
            onClick={() => groupToDelete && deleteGroupMutation.mutate(groupToDelete.id)}
          >
            {deleteGroupMutation.isPending ? 'Sletter…' : 'Slett'}
          </Button>
        </Frame>
      </Win95Dialog>

      <Win95Dialog
        open={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        title="Slett mappe"
        width="360px"
        minHeight="140px"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Slette mappen <strong>{categoryToDelete?.name}</strong>? Alle plasseringer i
          mappen fjernes.
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setCategoryToDelete(null)}>Avbryt</Button>
          <Button
            disabled={deleteCategoryMutation.isPending}
            onClick={() =>
              categoryToDelete && deleteCategoryMutation.mutate(categoryToDelete.id)
            }
          >
            {deleteCategoryMutation.isPending ? 'Sletter…' : 'Slett'}
          </Button>
        </Frame>
      </Win95Dialog>

      <Win95Dialog
        open={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Fjern vare"
        width="360px"
        minHeight="140px"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Fjerne <strong>{itemToDelete?.name}</strong> fra denne menyen? Varen blir
          værende i varebanken.
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setItemToDelete(null)}>Avbryt</Button>
          <Button
            disabled={deleteItemMutation.isPending}
            onClick={() => itemToDelete && deleteItemMutation.mutate(itemToDelete.id)}
          >
            {deleteItemMutation.isPending ? 'Fjerner…' : 'Fjern'}
          </Button>
        </Frame>
      </Win95Dialog>

      <Win95Dialog
        open={!!catalogToDelete}
        onClose={() => setCatalogToDelete(null)}
        title="Slett vare"
        width="360px"
        minHeight="140px"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Slette <strong>{catalogToDelete?.name}</strong> fra varebanken?
        </p>
        <Frame display="flex" justifyContent="flex-end" gap="$2" mt="$2">
          <Button onClick={() => setCatalogToDelete(null)}>Avbryt</Button>
          <Button
            disabled={deleteCatalogMutation.isPending}
            onClick={() =>
              catalogToDelete && deleteCatalogMutation.mutate(catalogToDelete.id)
            }
          >
            {deleteCatalogMutation.isPending ? 'Sletter…' : 'Slett'}
          </Button>
        </Frame>
      </Win95Dialog>
    </Frame>
  )
}
