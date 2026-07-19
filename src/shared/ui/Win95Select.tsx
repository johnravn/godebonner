import { createPortal } from 'react-dom'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

export type Win95SelectOption = {
  value: string
  label: string
}

type Win95SelectProps = {
  id?: string
  value: string
  options: Win95SelectOption[]
  onChange: (value: string) => void
  'aria-label'?: string
  style?: CSSProperties
}

type MenuPosition = {
  top: number
  left: number
  width: number
}

export function Win95Select({
  id,
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  style,
}: Win95SelectProps) {
  const autoId = useId()
  const triggerId = id ?? autoId
  const listId = `${triggerId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null)

  const selected = options.find((option) => option.value === value)
  const label = selected?.label ?? options[0]?.label ?? ''

  function updateMenuPosition() {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 1,
      left: rect.left,
      width: rect.width,
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPosition()
  }, [open])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    function onReposition() {
      updateMenuPosition()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="win95-select" style={style}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="win95-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="win95-select__value">{label}</span>
        <span className="win95-select__caret" aria-hidden />
      </button>

      {open && menuPos
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              className="win95-select__menu"
              role="listbox"
              aria-labelledby={triggerId}
              style={{
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
              }}
            >
              {options.map((option) => {
                const isSelected = option.value === value
                return (
                  <li
                    key={option.value || '__empty__'}
                    role="option"
                    aria-selected={isSelected}
                    className={`win95-select__option${isSelected ? ' win95-select__option--selected' : ''}`}
                    onClick={() => choose(option.value)}
                  >
                    {option.label}
                  </li>
                )
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
