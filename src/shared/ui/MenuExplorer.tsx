import { Button, Fieldset } from '@react95/core'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  REACT95_FOLDER_ICON,
  REACT95_MENU_ICON,
  React95Icon,
} from '#/shared/ui/react95-icons'

export type MenuExplorerCategory = {
  id: string
  name: string
  icon: string
  sort_order: number
}

export type MenuExplorerItem = {
  id: string
  category_id: string
  catalog_item_id: string
  name: string
  description: string
  price: number | string
  is_sold_out: boolean
  icon: string
  sort_order: number
}

export type MenuSelection =
  | { type: 'category'; id: string }
  | { type: 'item'; id: string }

type MenuExplorerProps = {
  rootLabel: string
  rootIcon?: string
  categories: MenuExplorerCategory[]
  items: MenuExplorerItem[]
  selection: MenuSelection | null
  onSelect: (selection: MenuSelection) => void
  children?: ReactNode
  emptyMessage?: string
  /** Legend on the tree group box. Defaults to rootLabel. */
  treeLegend?: string
  /** Legend on the detail/inspector group box. */
  detailLegend?: string
}

type CategoryNode = {
  category: MenuExplorerCategory
  items: MenuExplorerItem[]
}

export function formatMenuPrice(price: number | string): string {
  const n = typeof price === 'string' ? Number.parseFloat(price) : price
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`
}

export function MenuExplorer({
  rootLabel,
  rootIcon = REACT95_MENU_ICON,
  categories,
  items,
  selection,
  onSelect,
  children = null,
  emptyMessage = 'Ingen kategorier ennå.',
  treeLegend,
  detailLegend = 'Detaljer',
}: MenuExplorerProps) {
  const categoryNodes = useMemo((): CategoryNode[] => {
    const sortedCategories = [...categories].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'nb'),
    )

    return sortedCategories.map((category) => ({
      category,
      items: items
        .filter((item) => item.category_id === category.id)
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'nb'),
        ),
    }))
  }, [categories, items])

  const categoryIds = useMemo(
    () => categoryNodes.map((node) => node.category.id),
    [categoryNodes],
  )

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [rootExpanded, setRootExpanded] = useState(true)

  // Keep expand state in sync when categories change (drop stale ids).
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set<string>()
      for (const id of categoryIds) {
        if (prev.has(id)) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [categoryIds])

  const allExpanded =
    categoryIds.length > 0 && categoryIds.every((id) => expandedIds.has(id))

  function expandAll() {
    setRootExpanded(true)
    setExpandedIds(new Set(categoryIds))
  }

  function collapseAll() {
    setRootExpanded(false)
    setExpandedIds(new Set())
  }

  function toggleCategory(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const categorySelected =
    selection?.type === 'category' ? selection.id : null
  const itemSelected = selection?.type === 'item' ? selection.id : null

  return (
    <div className="win95-menu-explorer">
      <Fieldset
        legend={treeLegend ?? rootLabel}
        className="win95-menu-explorer__tree"
        p="$2"
      >
        <div className="win95-menu-explorer__tree-inner">
          <div className="win95-menu-explorer__tree-toolbar">
            <Button
              disabled={categoryIds.length === 0 || allExpanded}
              onClick={expandAll}
            >
              Utvid alle
            </Button>
            <Button
              disabled={categoryIds.length === 0 && !rootExpanded}
              onClick={collapseAll}
            >
              Minimer alle
            </Button>
          </div>

          <ul className="win95-menu-tree" role="tree">
          <li className="win95-menu-tree__node win95-menu-tree__node--root" role="treeitem">
            <div className="win95-menu-tree__row">
              <button
                type="button"
                className="win95-menu-tree__toggle"
                aria-expanded={rootExpanded}
                aria-label={rootExpanded ? 'Minimer meny' : 'Utvid meny'}
                onClick={() => setRootExpanded((open) => !open)}
              >
                {rootExpanded ? '−' : '+'}
              </button>
              <span className="win95-menu-tree__icon" aria-hidden>
                <React95Icon
                  icon={rootIcon}
                  size={20}
                  fallback={REACT95_MENU_ICON}
                />
              </span>
              <span className="win95-menu-tree__label">{rootLabel}</span>
            </div>

            {rootExpanded ? (
              <ul className="win95-menu-tree__children" role="group">
                {categoryNodes.length === 0 ? (
                  <li className="win95-menu-tree__empty">
                    <p className="win95-muted" style={{ margin: 0, fontSize: 12 }}>
                      {emptyMessage}
                    </p>
                  </li>
                ) : (
                  categoryNodes.map(({ category, items: categoryItems }) => {
                    const isOpen = expandedIds.has(category.id)
                    const isSelected = categorySelected === category.id
                    return (
                      <li
                        key={category.id}
                        className="win95-menu-tree__node"
                        role="treeitem"
                        aria-expanded={isOpen}
                        aria-selected={isSelected}
                      >
                        <div
                          className={[
                            'win95-menu-tree__row',
                            isSelected ? 'win95-menu-tree__row--selected' : null,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <button
                            type="button"
                            className="win95-menu-tree__toggle"
                            aria-expanded={isOpen}
                            aria-label={
                              isOpen
                                ? `Minimer ${category.name}`
                                : `Utvid ${category.name}`
                            }
                            onClick={() => toggleCategory(category.id)}
                          >
                            {isOpen ? '−' : '+'}
                          </button>
                          <button
                            type="button"
                            className="win95-menu-tree__select"
                            onClick={() =>
                              onSelect({ type: 'category', id: category.id })
                            }
                          >
                            <span className="win95-menu-tree__icon" aria-hidden>
                              <React95Icon
                                icon={category.icon || REACT95_FOLDER_ICON}
                                size={20}
                                fallback={REACT95_FOLDER_ICON}
                              />
                            </span>
                            <span className="win95-menu-tree__label-text">
                              {category.name}
                            </span>
                          </button>
                        </div>

                        {isOpen ? (
                          <ul className="win95-menu-tree__children" role="group">
                            {categoryItems.length === 0 ? (
                              <li className="win95-menu-tree__empty">
                                <p
                                  className="win95-muted"
                                  style={{ margin: 0, fontSize: 11 }}
                                >
                                  Tom mappe
                                </p>
                              </li>
                            ) : (
                              categoryItems.map((item) => {
                                const isItemSelected = itemSelected === item.id
                                return (
                                  <li
                                    key={item.id}
                                    className={[
                                      'win95-menu-tree__node',
                                      'win95-menu-tree__node--leaf',
                                      item.is_sold_out
                                        ? 'win95-menu-tree-sold-out'
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                    role="treeitem"
                                    aria-selected={isItemSelected}
                                  >
                                    <div
                                      className={[
                                        'win95-menu-tree__row',
                                        isItemSelected
                                          ? 'win95-menu-tree__row--selected'
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                    >
                                      <span
                                        className="win95-menu-tree__toggle-spacer"
                                        aria-hidden
                                      />
                                      <button
                                        type="button"
                                        className="win95-menu-tree__select"
                                        onClick={() =>
                                          onSelect({
                                            type: 'item',
                                            id: item.id,
                                          })
                                        }
                                      >
                                        <span
                                          className="win95-menu-tree__icon"
                                          aria-hidden
                                        >
                                          <React95Icon
                                            icon={item.icon}
                                            size={20}
                                          />
                                        </span>
                                        <span className="win95-menu-tree__label-text">
                                          {item.is_sold_out
                                            ? `${item.name} (Utsolgt)`
                                            : item.name}
                                        </span>
                                      </button>
                                    </div>
                                  </li>
                                )
                              })
                            )}
                          </ul>
                        ) : null}
                      </li>
                    )
                  })
                )}
              </ul>
            ) : null}
          </li>
        </ul>
        </div>
      </Fieldset>

      <Fieldset legend={detailLegend} className="win95-menu-explorer__detail">
        <div className="win95-menu-explorer__detail-body">
          {!selection ? (
            <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
              Velg en mappe eller vare i treet til venstre.
            </p>
          ) : (
            children
          )}
        </div>
      </Fieldset>
    </div>
  )
}
