import { Button, Frame } from '@react95/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { MEMBER_LOG_MAX_HEIGHT } from '#/features/admin/member-log-ui'
import {
  formatImportLogTimestamp,
  type MemberImportLogEntry,
} from '#/features/admin/member-import-log'

const IMPORT_LOG_ROW_HEIGHT = 72

type MemberImportLogPanelProps = {
  entries: MemberImportLogEntry[]
  onClear: () => void
}

export function MemberImportLogPanel({
  entries,
  onClear,
}: MemberImportLogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => IMPORT_LOG_ROW_HEIGHT,
    overscan: 6,
    getItemKey: (index) => entries[index]?.id ?? index,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    <Frame display="flex" flexDirection="column" gap="$2" style={{ minHeight: 0 }}>
      <Frame
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        gap="$2"
        flexWrap="wrap"
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Importstatus, feil/konflikter og når alle avvik er håndtert.
        </p>
        <Button disabled={entries.length === 0} onClick={onClear}>
          Tøm importlogg
        </Button>
      </Frame>

      {entries.length === 0 ? (
        <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
          Ingen importhendelser ennå.
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="admin-members-log-scroll"
          style={{
            maxHeight: MEMBER_LOG_MAX_HEIGHT,
            overflow: 'auto',
            border: '2px solid',
            borderColor: '#808080 #fff #fff #808080',
            background: '#fff',
            minHeight: 0,
          }}
        >
          <ul
            className="admin-members-import-log"
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: 'relative',
              margin: 0,
              padding: 0,
              listStyle: 'none',
            }}
          >
            {virtualRows.map((virtualRow) => {
              const entry = entries[virtualRow.index]
              if (!entry) return null
              return (
                <li
                  key={entry.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="admin-members-import-log__item"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="admin-members-import-log__meta">
                    <span>{formatImportLogTimestamp(entry.at)}</span>
                    <span className="win95-muted">
                      {entry.kind === 'import_completed'
                        ? 'Import'
                        : 'Avvik ferdig'}
                    </span>
                  </div>
                  <p className="admin-members-import-log__message">
                    {entry.message}
                  </p>
                  {entry.kind === 'import_completed' ? (
                    <div className="admin-members-import-log__stats win95-muted">
                      {[
                        entry.newlyAdded != null
                          ? `${entry.newlyAdded} nye`
                          : null,
                        entry.conflictsFound != null
                          ? `${entry.conflictsFound} konflikter`
                          : null,
                        entry.errorCount != null
                          ? `${entry.errorCount} feil`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Frame>
  )
}
