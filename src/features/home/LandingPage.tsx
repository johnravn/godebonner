import { Win95Desktop } from '#/features/home/Win95Desktop'
import { resolveDesktopOpen } from '#/features/home/resolve-desktop-open'
import type { DesktopWindowId } from '#/features/home/resolve-desktop-open'

type LandingSearch = {
  open?: string
  redirect?: string
}

type LandingPageProps = {
  search?: LandingSearch
}

function initialWindows(search?: LandingSearch): DesktopWindowId[] {
  const windows = new Set<DesktopWindowId>(['coupons'])
  const fromOpen = resolveDesktopOpen(search?.open)
  if (fromOpen) {
    windows.add(fromOpen)
  }
  return [...windows]
}

export function LandingPage({ search }: LandingPageProps) {
  return (
    <Win95Desktop
      initialWindows={initialWindows(search)}
      openFromSearch={search?.open}
      loginRedirect={search?.redirect}
    />
  )
}
