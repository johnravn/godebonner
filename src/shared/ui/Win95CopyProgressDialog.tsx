import { Frame, ProgressBar, TitleBar } from '@react95/core'
import {
  React95Icon,
  REACT95_FOLDER_ICON,
} from '#/shared/ui/react95-icons'

type Win95CopyProgressDialogProps = {
  open: boolean
  title?: string
  fromLabel: string
  toLabel: string
  statusText: string
  percent: number
}

/** Progress overlay — not a React95 Modal, so it won't steal desktop z-order. */
export function Win95CopyProgressDialog({
  open,
  title = 'Kopierer…',
  fromLabel,
  toLabel,
  statusText,
  percent,
}: Win95CopyProgressDialogProps) {
  if (!open) return null

  const clamped = Math.max(0, Math.min(100, Math.round(percent)))

  return (
    <>
      <div className="win95-dialog-backdrop" aria-hidden />
      <div className="win95-dialog-host">
        <div
          className="win95-dialog-panel"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <TitleBar active title={title} className="draggable" mb="$2" />

          <div
            className="win95-dialog-content win95-copy-progress"
            style={{ width: '380px', minHeight: '160px' }}
          >
            <Frame display="flex" flexDirection="column" gap="$3">
              <div className="win95-copy-progress__transfer" aria-hidden>
                <React95Icon
                  icon={REACT95_FOLDER_ICON}
                  size={32}
                  className="win95-copy-progress__folder"
                />
                <div className="win95-copy-progress__flight">
                  <span className="win95-copy-progress__paper win95-copy-progress__paper--1">
                    <React95Icon icon="FileText" size={16} />
                  </span>
                  <span className="win95-copy-progress__paper win95-copy-progress__paper--2">
                    <React95Icon icon="FileText" size={16} />
                  </span>
                  <span className="win95-copy-progress__paper win95-copy-progress__paper--3">
                    <React95Icon icon="FileText" size={16} />
                  </span>
                </div>
                <React95Icon
                  icon="FolderOpen"
                  size={32}
                  className="win95-copy-progress__folder"
                />
              </div>

              <dl className="win95-copy-progress__meta">
                <div>
                  <dt>Fra</dt>
                  <dd title={fromLabel}>{fromLabel}</dd>
                </div>
                <div>
                  <dt>Til</dt>
                  <dd title={toLabel}>{toLabel}</dd>
                </div>
              </dl>

              <p className="win95-copy-progress__status">{statusText}</p>

              <ProgressBar
                width="100%"
                percent={clamped}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clamped}
                aria-label="Importfremdrift"
              />
            </Frame>
          </div>
        </div>
      </div>
    </>
  )
}
