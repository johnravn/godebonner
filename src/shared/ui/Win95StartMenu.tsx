import { useEffect, useRef, type ReactNode } from 'react'

type Win95StartMenuProps = {
  children: ReactNode
}

function findStartButton(from: HTMLElement): HTMLElement | null {
  const taskbar = from.closest('.win95-taskbar')
  if (!taskbar) return null
  for (const button of taskbar.querySelectorAll('button')) {
    if (button.textContent?.includes('Start')) {
      return button
    }
  }
  return null
}

/**
 * Classic Win95 Start menu chrome: raised panel with a left brand strip
 * (originally “Windows 95”), reading bottom → top.
 *
 * Mounted only while the menu is open (React95 TaskBar). Closes on outside
 * click by toggling the Start button — TaskBar keeps open state private.
 */
export function Win95StartMenu({ children }: Win95StartMenuProps) {
  const shellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const shell = shellRef.current
      const target = event.target
      if (!shell || !(target instanceof Node)) return
      if (shell.contains(target)) return

      const startButton = findStartButton(shell)
      // Start button already toggles; don't double-toggle.
      if (startButton?.contains(target)) return

      startButton?.click()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [])

  return (
    <div ref={shellRef} className="win95-start-menu-shell">
      <div className="win95-start-menu-brand" aria-hidden>
        <span className="win95-start-menu-brand__text">
          <span className="win95-start-menu-brand__word">Gode</span>
          <span className="win95-start-menu-brand__bold">Bønner</span>
        </span>
      </div>
      {children}
    </div>
  )
}
