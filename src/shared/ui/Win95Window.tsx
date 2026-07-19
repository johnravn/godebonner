import { Frame, Modal, TitleBar, useModal } from '@react95/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MQ_TABLET } from '#/shared/ui/breakpoints'
import { useHydratedMediaQuery } from '#/shared/ui/useHydratedMediaQuery'

/** Matches taskbar reserve used in styles.css responsive window rules. */
const TASKBAR_RESERVE_PX = 56

type Point = { x: number; y: number }

type Win95WindowProps = {
  id: string
  open: boolean
  onClose: () => void
  title: string
  icon?: ReactNode
  width?: string
  height?: string
  minHeight?: string
  defaultPosition?: Point
  /** Show Maximize/Restore in the title bar (classic Win95 chrome). */
  maximizable?: boolean
  className?: string
  children: ReactNode
}

/** NeoDrag writes `translate: Xpx Ypx` (not transform) by default. */
function readTranslate(el: HTMLElement): Point {
  const value = el.style.translate
  if (!value || value === 'none') return { x: 0, y: 0 }
  const [x = 0, y = 0] = value.split(/\s+/).map((part) => parseFloat(part) || 0)
  return { x, y }
}

function clampTranslateToViewport(el: HTMLElement): Point {
  const current = readTranslate(el)
  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxLeft = Math.max(0, vw - rect.width)
  const maxTop = Math.max(0, vh - TASKBAR_RESERVE_PX - rect.height)
  const desiredLeft = Math.min(Math.max(0, rect.left), maxLeft)
  const desiredTop = Math.min(Math.max(0, rect.top), maxTop)
  const dx = desiredLeft - rect.left
  const dy = desiredTop - rect.top

  if (dx === 0 && dy === 0) return current
  return { x: current.x + dx, y: current.y + dy }
}

function applyTranslate(el: HTMLElement, point: Point) {
  el.style.translate = `${point.x}px ${point.y}px`
}

export function Win95Window({
  id,
  open,
  onClose,
  title,
  icon,
  width = '380px',
  height,
  minHeight = '160px',
  defaultPosition = { x: 64, y: 48 },
  maximizable = false,
  className,
  children,
}: Win95WindowProps) {
  const isCompactLayout = useHydratedMediaQuery(MQ_TABLET)
  const { focus } = useModal()
  const modalRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Point>(defaultPosition)
  const [isMaximized, setIsMaximized] = useState(false)

  // Keep a stable element identity — React95 Modal re-registers (remove→add→focus)
  // whenever `icon` changes by reference, which steals focus to other windows mid-drag.
  const titleIcon = useMemo(
    () =>
      icon ? <span className="win95-titlebar-icon">{icon}</span> : undefined,
    [icon],
  )

  useEffect(() => {
    if (!open) setIsMaximized(false)
  }, [open])

  const wasMaximizedRef = useRef(false)
  useEffect(() => {
    if (
      wasMaximizedRef.current &&
      !isMaximized &&
      open &&
      !isCompactLayout
    ) {
      const el = modalRef.current
      if (el) applyTranslate(el, position)
    }
    wasMaximizedRef.current = isMaximized
  }, [isMaximized, open, isCompactLayout, position])

  const dragDisabled = isCompactLayout || isMaximized

  const dragOptions = useMemo(
    () => ({
      // Uncontrolled while dragging — controlled `position` + setState every frame
      // re-renders Modal and re-triggers NeoDrag updates across all windows.
      defaultPosition: isCompactLayout || isMaximized ? { x: 0, y: 0 } : position,
      bounds: {
        top: 0,
        left: 0,
        right: 0,
        bottom: TASKBAR_RESERVE_PX,
      },
      disabled: dragDisabled,
      onDragEnd: ({ offsetX, offsetY }: { offsetX: number; offsetY: number }) => {
        const el = modalRef.current
        if (!el) {
          setPosition({ x: offsetX, y: offsetY })
          return
        }
        applyTranslate(el, { x: offsetX, y: offsetY })
        const next = clampTranslateToViewport(el)
        applyTranslate(el, next)
        setPosition(next)
      },
    }),
    // Recapture defaultPosition when the Modal remounts (`open`) or layout mode changes.
    // Do not depend on `position` itself — that would churn options after every drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
    [isCompactLayout, isMaximized, open, dragDisabled],
  )

  useEffect(() => {
    if (!open) return

    const keepOnScreen = () => {
      const el = modalRef.current
      if (!el) return

      if (isMaximized) {
        applyTranslate(el, { x: 0, y: 0 })
        return
      }

      if (isCompactLayout) {
        // Compact windows are CSS-centered; when the keyboard shrinks
        // visualViewport, nudge max-height so primary actions stay visible.
        const vv = window.visualViewport
        if (!vv) return
        const available = Math.max(160, vv.height - TASKBAR_RESERVE_PX - 16)
        el.style.setProperty('--win95-vv-max-height', `${available}px`)
        return
      }

      const next = clampTranslateToViewport(el)
      applyTranslate(el, next)
      setPosition((prev) =>
        prev.x === next.x && prev.y === next.y ? prev : next,
      )
    }

    const raf = requestAnimationFrame(keepOnScreen)
    window.addEventListener('resize', keepOnScreen)
    window.visualViewport?.addEventListener('resize', keepOnScreen)
    window.visualViewport?.addEventListener('scroll', keepOnScreen)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', keepOnScreen)
      window.visualViewport?.removeEventListener('resize', keepOnScreen)
      window.visualViewport?.removeEventListener('scroll', keepOnScreen)
      modalRef.current?.style.removeProperty('--win95-vv-max-height')
    }
  }, [open, isCompactLayout, isMaximized])

  const titleBarOptions = useMemo(() => {
    const options = [<Modal.Minimize key="minimize" />]
    if (maximizable) {
      options.push(
        isMaximized ? (
          <TitleBar.Restore
            key="restore"
            aria-label="Gjenopprett"
            onClick={() => setIsMaximized(false)}
          />
        ) : (
          <TitleBar.Maximize
            key="maximize"
            aria-label="Maksimer"
            onClick={() => setIsMaximized(true)}
          />
        ),
      )
    }
    options.push(<TitleBar.Close key="close" onClick={onClose} />)
    return options
  }, [maximizable, isMaximized, onClose])

  if (!open) return null

  const fitContent = width === 'auto'
  const windowClassName = [
    'win95-window--responsive',
    fitContent ? 'win95-window--fit-content' : null,
    isMaximized ? 'win95-window--maximized' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const fillContent = Boolean(height) || isMaximized

  return (
    <Modal
      ref={modalRef}
      id={id}
      className={windowClassName}
      title={title}
      icon={titleIcon}
      hasWindowButton
      dragOptions={dragOptions}
      titleBarOptions={titleBarOptions}
      onPointerDown={() => {
        // React95 Modal only focuses on mouseDown; touch needs pointerDown.
        focus(id)
      }}
    >
      <Modal.Content
        className={[
          'win95-window-content',
          fitContent ? 'win95-window--fit-content' : null,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        width={isMaximized ? '100%' : width}
        height={isMaximized ? '100%' : height}
        minHeight={isMaximized ? 0 : minHeight}
        boxShadow="$in"
        bgColor="material"
        p="$3"
        overflow="auto"
      >
        {/* Only fill the content area when an explicit height is set
            (e.g. Medlemmer) or the window is maximized. Otherwise size to
            content to avoid empty gray space under short windows. */}
        <Frame
          display="flex"
          flexDirection="column"
          gap="$3"
          {...(fillContent
            ? { height: '100%', style: { minHeight: '100%' } }
            : undefined)}
        >
          {children}
        </Frame>
      </Modal.Content>
    </Modal>
  )
}
