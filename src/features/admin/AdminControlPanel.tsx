import { Frame } from '@react95/core'
import { useState } from 'react'
import type { ReactNode } from 'react'

export type ControlPanelApp = {
  id: string
  title: string
  icon: ReactNode
  onOpen: () => void
}

type AdminControlPanelProps = {
  apps: ControlPanelApp[]
}

/**
 * Touch-first: open on single click. Classic Win95 used double-click, but
 * that fails on phones/tablets and in Chrome device mode.
 */
export function AdminControlPanel({ apps }: AdminControlPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <Frame display="flex" flexDirection="column" gap="$2">
      <Frame
        className="win95-control-panel"
        bgColor="canvas"
        boxShadow="$in"
        p="$3"
        overflow="auto"
      >
        <div className="win95-control-panel__grid" role="list">
          {apps.map((app) => {
            const selected = selectedId === app.id
            return (
              <button
                key={app.id}
                type="button"
                role="listitem"
                className={`win95-control-panel__item${selected ? ' win95-control-panel__item--selected' : ''}`}
                onClick={() => {
                  setSelectedId(app.id)
                  app.onOpen()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedId(app.id)
                    app.onOpen()
                  }
                }}
              >
                <span className="win95-control-panel__glyph">{app.icon}</span>
                <span className="win95-control-panel__label">{app.title}</span>
              </button>
            )
          })}
        </div>
      </Frame>
      <p className="win95-muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.4 }}>
        Trenger du en gjennomgang? Åpne Velkomstomvisning fra Start-menyen eller
        Kontrollpanelet.
      </p>
      <Frame
        as="footer"
        className="win95-control-panel__status"
        boxShadow="$in"
        bgColor="material"
        px="$2"
        py="$1"
      >
        {apps.length} objekt{apps.length === 1 ? '' : 'er'}
      </Frame>
    </Frame>
  )
}
