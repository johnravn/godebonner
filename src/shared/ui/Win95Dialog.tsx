import { Button, Frame, TitleBar } from '@react95/core'
import type { MouseEvent, ReactNode } from 'react'

type ModalButton = {
  value: string
  onClick: (event: MouseEvent) => void
}

type Win95DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  buttons?: ModalButton[]
  width?: string
  minHeight?: string
}

/** Overlay dialog — not a React95 Modal, so it won't steal desktop z-order. */
export function Win95Dialog({
  open,
  onClose,
  title,
  children,
  buttons,
  width = '360px',
  minHeight = '120px',
}: Win95DialogProps) {
  if (!open) return null

  return (
    <>
      <div className="win95-dialog-backdrop" onClick={onClose} aria-hidden />
      <div className="win95-dialog-host">
        <div className="win95-dialog-panel" role="dialog" aria-modal="true" aria-label={title}>
          <TitleBar active title={title} className="draggable" mb="$2">
            <TitleBar.OptionsBox>
              <TitleBar.Close onClick={onClose} aria-label="Lukk" />
            </TitleBar.OptionsBox>
          </TitleBar>

          <div
            className="win95-dialog-content"
            style={{ width, minHeight }}
          >
            <Frame display="flex" flexDirection="column" gap="$3">
              {children}
            </Frame>
          </div>

          {buttons && buttons.length > 0 ? (
            <div className="win95-dialog-buttons">
              {buttons.map((button) => (
                <Button
                  key={button.value}
                  onClick={button.onClick}
                  value={button.value}
                >
                  {button.value}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
