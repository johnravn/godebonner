import { Button, Tooltip } from '@react95/core'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Win95IconButtonProps = {
  /** Accessible name and hover tooltip text. */
  label: string
  children: ReactNode
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label' | 'title' | 'type'
>

/** Compact raised Win95 button for icon-only actions (table rows, toolbars). */
export function Win95IconButton({
  label,
  children,
  className,
  disabled,
  onClick,
  ...rest
}: Win95IconButtonProps) {
  return (
    <Tooltip text={label} delay={400} className="win95-icon-btn-tooltip">
      <Button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={['win95-icon-btn', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </Button>
    </Tooltip>
  )
}
