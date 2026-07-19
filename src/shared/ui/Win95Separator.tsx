import type { HTMLAttributes } from 'react'

type Win95SeparatorProps = {
  orientation?: 'horizontal' | 'vertical'
  /** Length of the separator; default 100%. */
  size?: string | number
} & HTMLAttributes<HTMLDivElement>

/**
 * Etched Win95 separator (same look as `Separator` from the `react95` package).
 * `@react95/core` only ships `List.Divider`; this matches the classic separator
 * using React95 theme tokens.
 */
export function Win95Separator({
  orientation = 'horizontal',
  size = '100%',
  className,
  style,
  ...rest
}: Win95SeparatorProps) {
  const length = typeof size === 'number' ? `${size}px` : size
  const isVertical = orientation === 'vertical'

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={[
        'win95-separator',
        isVertical ? 'win95-separator--vertical' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...(isVertical ? { height: length } : { width: length }),
        ...style,
      }}
      {...rest}
    />
  )
}
