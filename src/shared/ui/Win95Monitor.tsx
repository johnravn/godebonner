import type { CSSProperties, ReactNode } from 'react'

type Win95MonitorProps = {
  children?: ReactNode
  backgroundStyles?: CSSProperties
  className?: string
  /** Outer body width in px (default matches react95 Monitor). */
  width?: number
  /** Outer body height in px (default matches react95 Monitor). */
  height?: number
}

/**
 * CRT-style monitor frame matching the `Monitor` component from the
 * `react95` (react95.io) package, adapted for @react95/core theme tokens.
 */
export function Win95Monitor({
  children,
  backgroundStyles,
  className,
  width = 195,
  height = 155,
}: Win95MonitorProps) {
  return (
    <div
      className={['win95-monitor', className].filter(Boolean).join(' ')}
      style={
        {
          '--win95-monitor-w': `${width}px`,
          '--win95-monitor-h': `${height}px`,
        } as CSSProperties
      }
    >
      <div className="win95-monitor__inner">
        <div className="win95-monitor__body">
          <div className="win95-monitor__screen" style={backgroundStyles}>
            {children}
          </div>
        </div>
        <div className="win95-monitor__stand" aria-hidden />
      </div>
    </div>
  )
}
