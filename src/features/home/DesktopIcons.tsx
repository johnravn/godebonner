import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { MQ_TABLET } from '#/shared/ui/breakpoints'
import { useHydratedMediaQuery } from '#/shared/ui/useHydratedMediaQuery'
import { useMediaQuery } from '#/shared/ui/useMediaQuery'

export type DesktopIconItem = {
  id: string
  title: string
  icon: ReactNode
  onOpen: () => void
  placement?: 'main' | 'recycle'
}

type DesktopIconsProps = {
  items: DesktopIconItem[]
}

function DesktopIconButton({
  item,
  selected,
  onSelect,
  openOnSingleClick,
}: {
  item: DesktopIconItem
  selected: boolean
  onSelect: () => void
  openOnSingleClick: boolean
}) {
  return (
    <button
      type="button"
      className={`win95-desktop-icon${selected ? ' win95-desktop-icon--selected' : ''}`}
      onClick={() => {
        onSelect()
        if (openOnSingleClick) {
          item.onOpen()
        }
      }}
      onDoubleClick={() => {
        if (!openOnSingleClick) {
          item.onOpen()
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          item.onOpen()
        }
      }}
    >
      <span className="win95-desktop-icon__glyph">{item.icon}</span>
      <span className="win95-desktop-icon__label">{item.title}</span>
    </button>
  )
}

export function DesktopIcons({ items }: DesktopIconsProps) {
  const isCompact = useHydratedMediaQuery(MQ_TABLET)
  const isCoarsePointer = useMediaQuery('(pointer: coarse)')
  const openOnSingleClick = isCompact || isCoarsePointer
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('.win95-desktop-icon')) {
        setSelectedId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selectedId])

  const mainItems = items.filter((item) => item.placement !== 'recycle')
  const recycleItems = items.filter((item) => item.placement === 'recycle')

  return (
    <div className="win95-desktop-icons" aria-label="Skrivebord">
      <div className="win95-desktop-icons__main">
        {mainItems.map((item) => (
          <DesktopIconButton
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onSelect={() => setSelectedId(item.id)}
            openOnSingleClick={openOnSingleClick}
          />
        ))}
      </div>
      {recycleItems.length > 0 ? (
        <div className="win95-desktop-icons__recycle">
          {recycleItems.map((item) => (
            <DesktopIconButton
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={() => setSelectedId(item.id)}
              openOnSingleClick={openOnSingleClick}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
