import { User } from '@react95/icons'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type TaskbarUserTrayProps = {
  label: string
  onOpen: () => void
}

/**
 * Injects a logged-in tray icon into React95's TaskBar, left of the clock.
 * TaskBar does not accept tray children, so we mount into the bar DOM.
 */
export function TaskbarUserTray({ label, onOpen }: TaskbarUserTrayProps) {
  const [mount, setMount] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const taskbar = document.querySelector('.win95-taskbar')
    if (!(taskbar instanceof HTMLElement)) return

    const el = document.createElement('div')
    el.className = 'win95-taskbar-user-mount'
    const clock = taskbar.lastElementChild
    if (clock) {
      taskbar.insertBefore(el, clock)
    } else {
      taskbar.appendChild(el)
    }
    setMount(el)

    return () => {
      el.remove()
      setMount(null)
    }
  }, [])

  if (!mount) return null

  return createPortal(
    <button
      type="button"
      className="win95-taskbar-user"
      title={label}
      aria-label={label}
      onClick={onOpen}
    >
      <User variant="16x16_4" width={16} height={16} />
    </button>,
    mount,
  )
}
