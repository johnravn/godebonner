import { List, TaskBar, useModal } from '@react95/core'
import { useQuery } from '@tanstack/react-query'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Computer,
  FileSettings,
  FileText,
  FileTextSettings,
  HelpBook,
  Keys,
  Person116,
  Phone2,
  RecycleEmpty,
  RecycleFull,
  Sol1,
  User,
  Winmine1,
} from '@react95/icons'
import { useAuth } from '#/app/providers/AuthProvider'
import { AdminControlPanel } from '#/features/admin/AdminControlPanel'
import { AdminMembersPage } from '#/features/admin/AdminMembersPage'
import { AdminMenyPage } from '#/features/admin/AdminMenyPage'
import { AdminOrganizationPage } from '#/features/admin/AdminOrganizationPage'
import { AdminPapirkurvPage } from '#/features/admin/AdminPapirkurvPage'
import { AdminStatusPage } from '#/features/admin/AdminStatusPage'
import { AdminUsersPage } from '#/features/admin/AdminUsersPage'
import { AdminWelcomeTour } from '#/features/admin/AdminWelcomeTour'
import { RegisterCouponWindow } from '#/features/admin/RegisterCouponWindow'
import { CouponLookupWindow } from '#/features/home/CouponLookupWindow'
import { DesktopIcons } from '#/features/home/DesktopIcons'
import type { DesktopIconItem } from '#/features/home/DesktopIcons'
import { DevToolsWindow } from '#/features/home/DevToolsWindow'
import { InfoWindow } from '#/features/home/InfoWindow'
import { LoginWindow } from '#/features/home/LoginWindow'
import { MenyWindow } from '#/features/home/MenyWindow'
import { MinesweeperWindow } from '#/features/home/MinesweeperWindow'
import { RecycleBinWindow } from '#/features/home/RecycleBinWindow'
import { SolitaireWindow } from '#/features/home/SolitaireWindow'
import { TaskbarUserTray } from '#/features/home/TaskbarUserTray'
import { getSupabase } from '#/shared/api/supabase'
import { fetchIsAdmin } from '#/shared/auth/require-admin'
import { usePwa } from '#/shared/pwa/PwaProvider'
import { MQ_TABLET } from '#/shared/ui/breakpoints'
import { useHydratedMediaQuery } from '#/shared/ui/useHydratedMediaQuery'
import { Win95Separator } from '#/shared/ui/Win95Separator'
import { Win95StartMenu } from '#/shared/ui/Win95StartMenu'
import { Win95Window } from '#/shared/ui/Win95Window'
import type { DesktopWindowId } from '#/features/home/resolve-desktop-open'
import { resolveDesktopOpen } from '#/features/home/resolve-desktop-open'

const IS_DEV = import.meta.env.DEV

export type { AdminWindowId, DesktopWindowId, PublicWindowId } from '#/features/home/resolve-desktop-open'

type AppVisibility = 'always' | 'dev' | 'admin' | 'signed-out' | 'signed-in'

type DesktopAppDef = {
  id: string
  title: string
  visibility: AppVisibility
  dividerBefore?: boolean
  placement?: 'main' | 'recycle'
  /** Show on desktop icons; default true. */
  desktopIcon?: boolean
  /** Show in Start menu; default true. Control-panel apps stay panel-only. */
  startMenu?: boolean
  action: { type: 'window'; windowId: DesktopWindowId }
  icon16: ReactNode
  icon32: ReactNode
}

type Win95DesktopProps = {
  initialWindows?: DesktopWindowId[]
  /** Deep-link window from `?open=` — applied whenever it changes. */
  openFromSearch?: string
  loginRedirect?: string
}

const WINDOW_META = {
  coupons: {
    title: 'Kuponger',
    icon: <Phone2 variant="16x16_4" />,
    width: '480px',
    minHeight: '120px',
    position: { x: 72, y: 40 },
  },
  meny: {
    title: 'Meny',
    icon: <FileText variant="16x16_4" />,
    width: '560px',
    height: '480px',
    minHeight: '320px',
    position: { x: 48, y: 28 },
    className: 'win95-window--meny',
  },
  info: {
    title: 'Om Godebonner',
    icon: <HelpBook variant="16x16_4" />,
    width: '360px',
    minHeight: '120px',
    position: { x: 120, y: 72 },
  },
  login: {
    title: 'Logg inn',
    icon: <Keys variant="32x32_4" width={16} height={16} />,
    width: '380px',
    minHeight: '120px',
    position: { x: 168, y: 104 },
  },
  account: {
    title: 'Konto',
    icon: <Keys variant="32x32_4" width={16} height={16} />,
    width: '380px',
    minHeight: '120px',
    position: { x: 168, y: 104 },
  },
  devtools: {
    title: 'DevTools',
    icon: <FileSettings variant="16x16_4" />,
    width: '420px',
    minHeight: '120px',
    position: { x: 96, y: 56 },
  },
  minesweeper: {
    title: 'Minesveiper',
    icon: <Winmine1 variant="16x16_4" />,
    width: 'auto',
    minHeight: '120px',
    position: { x: 100, y: 48 },
  },
  solitaire: {
    title: 'Kabal',
    icon: <Sol1 variant="16x16_4" />,
    width: 'auto',
    minHeight: '480px',
    position: { x: 56, y: 32 },
  },
  recycle: {
    title: 'Papirkurv',
    icon: <RecycleEmpty variant="16x16_4" />,
    width: '360px',
    minHeight: '120px',
    position: { x: 140, y: 64 },
  },
  'admin-panel': {
    title: 'Administrasjon',
    icon: <Computer variant="16x16_4" />,
    width: '520px',
    minHeight: '120px',
    position: { x: 36, y: 28 },
    className: 'win95-window--admin',
  },
  'admin-register': {
    title: 'Registrer kupong',
    icon: <Phone2 variant="16x16_4" />,
    width: '560px',
    minHeight: '120px',
    position: { x: 120, y: 48 },
  },
  'admin-members': {
    title: 'Medlemmer',
    icon: <Person116 variant="16x16_4" />,
    width: '900px',
    height: '560px',
    minHeight: '420px',
    position: { x: 56, y: 40 },
    className: 'win95-window--admin win95-window--members',
  },
  'admin-meny': {
    title: 'Rediger meny',
    icon: <FileText variant="16x16_4" />,
    width: '780px',
    height: '560px',
    minHeight: '420px',
    position: { x: 72, y: 36 },
    className: 'win95-window--admin win95-window--meny',
  },
  'admin-organization': {
    title: 'Organisasjon',
    icon: <FileTextSettings variant="16x16_4" />,
    width: '480px',
    minHeight: '120px',
    position: { x: 100, y: 48 },
    className: 'win95-window--admin',
  },
  'admin-papirkurv': {
    title: 'Rediger papirkurv',
    icon: <RecycleEmpty variant="16x16_4" />,
    width: '520px',
    minHeight: '120px',
    position: { x: 96, y: 56 },
  },
  'admin-users': {
    title: 'Brukere',
    icon: <User variant="16x16_4" />,
    width: '640px',
    minHeight: '120px',
    position: { x: 80, y: 52 },
    className: 'win95-window--admin',
  },
  'admin-status': {
    title: 'Systemstatus',
    icon: <FileSettings variant="16x16_4" />,
    width: '520px',
    minHeight: '120px',
    position: { x: 108, y: 44 },
  },
  'admin-welcome': {
    title: 'Velkommen',
    icon: <HelpBook variant="16x16_4" />,
    width: '720px',
    minHeight: '280px',
    position: { x: 88, y: 32 },
  },
} as const

function isAppVisible(
  visibility: AppVisibility,
  opts: { isAdmin: boolean; signedIn: boolean },
): boolean {
  switch (visibility) {
    case 'always':
      return true
    case 'dev':
      return IS_DEV
    case 'admin':
      return opts.isAdmin
    case 'signed-out':
      return !opts.signedIn
    case 'signed-in':
      return opts.signedIn
  }
}

export function Win95Desktop({
  initialWindows = ['coupons'],
  openFromSearch,
  loginRedirect,
}: Win95DesktopProps) {
  const { user } = useAuth()
  const { canInstallFromMenu, openInstallDialog } = usePwa()
  const [openWindows, setOpenWindows] = useState<Set<DesktopWindowId>>(
    () => new Set(initialWindows),
  )

  const { data: isAdmin } = useQuery({
    queryKey: ['auth', 'is-admin', user?.id ?? '__none__'],
    enabled: !!user?.id,
    queryFn: () => fetchIsAdmin(user!.id),
  })

  const { data: publicMenuEnabled = true } = useQuery({
    queryKey: ['organization-settings', 'public-menu-enabled'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('organization_settings')
        .select('public_menu_enabled')
        .eq('id', true)
        .single()
      if (error) throw error
      return data.public_menu_enabled
    },
  })

  const signedIn = !!user
  const adminReady = !!(user && isAdmin)

  const { data: recycleCount = 0 } = useQuery({
    queryKey: ['public', 'recycle-bin'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('recycle_bin_items')
        .select('id, name, description, icon, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    select: (rows) => rows.length,
  })

  const recycleFull = recycleCount > 0

  const { restore, focus, minimize } = useModal()
  const isCompactLayout = useHydratedMediaQuery(MQ_TABLET)

  const openWindow = useCallback(
    (id: DesktopWindowId) => {
      if (id === 'meny' && !publicMenuEnabled) return
      const modalId = `window-${id}`
      setOpenWindows((prev) => {
        if (prev.has(id)) return prev
        return new Set(prev).add(id)
      })
      // Always raise after paint. Stacked tablet windows otherwise stay under
      // the control panel (React95 only focuses on mouseDown).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          restore(modalId)
          focus(modalId)
        })
      })
    },
    [focus, publicMenuEnabled, restore],
  )

  const openAdminTool = useCallback(
    (id: DesktopWindowId) => {
      openWindow(id)
      // On phone/tablet every window is centered — hide the panel so the tool
      // is actually visible (taskbar still has Kontrollpanel).
      if (isCompactLayout) {
        minimize('window-admin-panel')
      }
    },
    [isCompactLayout, minimize, openWindow],
  )

  const closeWindow = useCallback((id: DesktopWindowId) => {
    setOpenWindows((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  useEffect(() => {
    const id = resolveDesktopOpen(openFromSearch)
    if (!id) return
    if (id.startsWith('admin-') && !adminReady) return
    if (id === 'meny' && !publicMenuEnabled) return
    openWindow(id)
  }, [adminReady, openFromSearch, openWindow, publicMenuEnabled])

  useEffect(() => {
    if (publicMenuEnabled) return
    setOpenWindows((prev) => {
      if (!prev.has('meny')) return prev
      const next = new Set(prev)
      next.delete('meny')
      return next
    })
  }, [publicMenuEnabled])

  const desktopApps: DesktopAppDef[] = useMemo(
    () => [
      {
        id: 'coupons',
        title: 'Kuponger',
        visibility: 'always',
        action: { type: 'window', windowId: 'coupons' },
        icon16: <Phone2 variant="16x16_4" />,
        icon32: <Phone2 variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'meny',
        title: 'Meny',
        visibility: 'always',
        action: { type: 'window', windowId: 'meny' },
        icon16: <FileText variant="16x16_4" />,
        icon32: <FileText variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'info',
        title: 'Om Godebonner',
        visibility: 'always',
        action: { type: 'window', windowId: 'info' },
        icon16: <HelpBook variant="16x16_4" />,
        icon32: <HelpBook variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'login',
        title: 'Logg inn',
        visibility: 'signed-out',
        action: { type: 'window', windowId: 'login' },
        icon16: <Keys variant="32x32_4" width={16} height={16} />,
        icon32: <Keys variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'account',
        title: 'Konto',
        visibility: 'signed-in',
        action: { type: 'window', windowId: 'login' },
        icon16: <Keys variant="32x32_4" width={16} height={16} />,
        icon32: <Keys variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'minesweeper',
        title: 'Minesveiper',
        visibility: 'always',
        startMenu: false,
        action: { type: 'window', windowId: 'minesweeper' },
        icon16: <Winmine1 variant="16x16_4" />,
        icon32: <Winmine1 variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'solitaire',
        title: 'Kabal',
        visibility: 'always',
        startMenu: false,
        action: { type: 'window', windowId: 'solitaire' },
        icon16: <Sol1 variant="16x16_4" />,
        icon32: <Sol1 variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'recycle',
        title: 'Papirkurv',
        visibility: 'always',
        placement: 'recycle',
        startMenu: false,
        action: { type: 'window', windowId: 'recycle' },
        icon16: recycleFull ? (
          <RecycleFull variant="16x16_4" />
        ) : (
          <RecycleEmpty variant="16x16_4" />
        ),
        icon32: recycleFull ? (
          <RecycleFull variant="32x32_4" width={32} height={32} />
        ) : (
          <RecycleEmpty variant="32x32_4" width={32} height={32} />
        ),
      },
      {
        id: 'devtools',
        title: 'DevTools',
        visibility: 'dev',
        dividerBefore: true,
        action: { type: 'window', windowId: 'devtools' },
        icon16: <FileSettings variant="16x16_4" />,
        icon32: <FileSettings variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'admin-panel',
        title: 'Administrasjon',
        visibility: 'admin',
        dividerBefore: true,
        desktopIcon: true,
        action: { type: 'window', windowId: 'admin-panel' },
        icon16: <Computer variant="16x16_4" />,
        icon32: <Computer variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'admin-register',
        title: 'Registrer kupong',
        visibility: 'admin',
        desktopIcon: false,
        startMenu: false,
        action: { type: 'window', windowId: 'admin-register' },
        icon16: <Phone2 variant="16x16_4" />,
        icon32: <Phone2 variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'admin-welcome',
        title: 'Velkomstomvisning',
        visibility: 'admin',
        desktopIcon: false,
        startMenu: false,
        action: { type: 'window', windowId: 'admin-welcome' },
        icon16: <HelpBook variant="16x16_4" />,
        icon32: <HelpBook variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'admin-members',
        title: 'Medlemmer',
        visibility: 'admin',
        desktopIcon: false,
        startMenu: false,
        action: { type: 'window', windowId: 'admin-members' },
        icon16: <Person116 variant="16x16_4" />,
        icon32: <Person116 variant="16x16_4" width={32} height={32} />,
      },
      {
        id: 'admin-meny',
        title: 'Rediger meny',
        visibility: 'admin',
        desktopIcon: false,
        startMenu: false,
        action: { type: 'window', windowId: 'admin-meny' },
        icon16: <FileText variant="16x16_4" />,
        icon32: <FileText variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'admin-organization',
        title: 'Organisasjon',
        visibility: 'admin',
        desktopIcon: false,
        startMenu: false,
        action: { type: 'window', windowId: 'admin-organization' },
        icon16: <FileTextSettings variant="16x16_4" />,
        icon32: <FileTextSettings variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'admin-papirkurv',
        title: 'Rediger papirkurv',
        visibility: 'admin',
        desktopIcon: false,
        startMenu: false,
        action: { type: 'window', windowId: 'admin-papirkurv' },
        icon16: <RecycleEmpty variant="16x16_4" />,
        icon32: <RecycleEmpty variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'admin-users',
        title: 'Brukere',
        visibility: 'admin',
        desktopIcon: false,
        startMenu: false,
        action: { type: 'window', windowId: 'admin-users' },
        icon16: <User variant="16x16_4" />,
        icon32: <User variant="32x32_4" width={32} height={32} />,
      },
      {
        id: 'admin-status',
        title: 'Status',
        visibility: 'admin',
        desktopIcon: false,
        startMenu: false,
        action: { type: 'window', windowId: 'admin-status' },
        icon16: <FileSettings variant="16x16_4" />,
        icon32: <FileSettings variant="32x32_4" width={32} height={32} />,
      },
    ],
    [recycleFull],
  )

  const visibleApps = useMemo(
    () =>
      desktopApps.filter((app) => {
        if (app.id === 'meny' && !publicMenuEnabled) return false
        return isAppVisible(app.visibility, {
          isAdmin: adminReady,
          signedIn,
        })
      }),
    [adminReady, desktopApps, publicMenuEnabled, signedIn],
  )

  const runApp = useCallback(
    (app: DesktopAppDef) => {
      openWindow(app.action.windowId)
    },
    [openWindow],
  )

  const handleAuthed = useCallback(
    (authedIsAdmin: boolean) => {
      if (authedIsAdmin) {
        closeWindow('login')
        openWindow('admin-panel')
        openWindow('admin-register')
        return
      }
      // Non-admins stay in the Konto window with pending-access messaging.
      openWindow('login')
    },
    [closeWindow, openWindow],
  )

  const startMenu = useMemo(() => {
    const menuApps = visibleApps.filter((app) => app.startMenu !== false)
    let sectionSeparatorShown = false

    return (
      <Win95StartMenu>
        <List className="win95-start-menu" width="100%">
          {menuApps.map((app) => {
            const showSeparator = !!app.dividerBefore && !sectionSeparatorShown
            if (showSeparator) sectionSeparatorShown = true

            return (
              <Fragment key={app.id}>
                {showSeparator ? (
                  <li
                    className="win95-start-menu__separator"
                    role="presentation"
                  >
                    <Win95Separator />
                  </li>
                ) : null}
                <List.Item icon={app.icon32} onClick={() => runApp(app)}>
                  {app.title}
                </List.Item>
              </Fragment>
            )
          })}
          {canInstallFromMenu ? (
            <>
              <li
                className="win95-start-menu__separator"
                role="presentation"
              >
                <Win95Separator />
              </li>
              <List.Item
                icon={<Computer variant="32x32_4" />}
                onClick={() => openInstallDialog()}
              >
                Installer app…
              </List.Item>
            </>
          ) : null}
        </List>
      </Win95StartMenu>
    )
  }, [canInstallFromMenu, openInstallDialog, runApp, visibleApps])

  const desktopIconItems: DesktopIconItem[] = useMemo(
    () =>
      visibleApps
        .filter((app) => app.desktopIcon !== false)
        .map((app) => ({
          id: app.id,
          title: app.title,
          icon: app.icon32,
          onOpen: () => runApp(app),
          placement: app.placement ?? 'main',
        })),
    [runApp, visibleApps],
  )

  const panelApps = useMemo(
    () =>
      (
        [
          'admin-register',
          'admin-members',
          'admin-meny',
          'admin-organization',
          'admin-papirkurv',
          'admin-users',
          'admin-status',
          'admin-welcome',
        ] as const
      ).map((id) => {
        const app = desktopApps.find((a) => a.id === id)!
        return {
          id,
          title: app.title,
          icon: app.icon32,
          onOpen: () => openAdminTool(id),
        }
      }),
    [desktopApps, openAdminTool],
  )

  return (
    <div className="win95-desktop-surface">
      <DesktopIcons items={desktopIconItems} />
      <TaskBar list={startMenu} className="win95-taskbar" />
      {user ? (
        <TaskbarUserTray
          label={
            user.email ? `Logget inn som ${user.email}` : 'Logget inn'
          }
          onOpen={() => openWindow('login')}
        />
      ) : null}

      <Win95Window
        id="window-coupons"
        open={openWindows.has('coupons')}
        onClose={() => closeWindow('coupons')}
        title={WINDOW_META.coupons.title}
        icon={WINDOW_META.coupons.icon}
        width={WINDOW_META.coupons.width}
        minHeight={WINDOW_META.coupons.minHeight}
        defaultPosition={WINDOW_META.coupons.position}
      >
        <CouponLookupWindow />
      </Win95Window>

      <Win95Window
        id="window-meny"
        open={publicMenuEnabled && openWindows.has('meny')}
        onClose={() => closeWindow('meny')}
        title={WINDOW_META.meny.title}
        icon={WINDOW_META.meny.icon}
        width={WINDOW_META.meny.width}
        height={WINDOW_META.meny.height}
        minHeight={WINDOW_META.meny.minHeight}
        defaultPosition={WINDOW_META.meny.position}
        className={WINDOW_META.meny.className}
      >
        <MenyWindow />
      </Win95Window>

      <Win95Window
        id="window-info"
        open={openWindows.has('info')}
        onClose={() => closeWindow('info')}
        title={WINDOW_META.info.title}
        icon={WINDOW_META.info.icon}
        width={WINDOW_META.info.width}
        minHeight={WINDOW_META.info.minHeight}
        defaultPosition={WINDOW_META.info.position}
      >
        <InfoWindow />
      </Win95Window>

      <Win95Window
        id="window-login"
        open={openWindows.has('login')}
        onClose={() => closeWindow('login')}
        title={signedIn ? WINDOW_META.account.title : WINDOW_META.login.title}
        icon={WINDOW_META.login.icon}
        width={WINDOW_META.login.width}
        minHeight={
          signedIn ? WINDOW_META.account.minHeight : WINDOW_META.login.minHeight
        }
        defaultPosition={WINDOW_META.login.position}
      >
        <LoginWindow
          redirect={loginRedirect}
          onClose={() => closeWindow('login')}
          onAuthed={handleAuthed}
        />
      </Win95Window>

      <Win95Window
        id="window-minesweeper"
        open={openWindows.has('minesweeper')}
        onClose={() => closeWindow('minesweeper')}
        title={WINDOW_META.minesweeper.title}
        icon={WINDOW_META.minesweeper.icon}
        width={WINDOW_META.minesweeper.width}
        minHeight={WINDOW_META.minesweeper.minHeight}
        defaultPosition={WINDOW_META.minesweeper.position}
      >
        <MinesweeperWindow />
      </Win95Window>

      <Win95Window
        id="window-solitaire"
        open={openWindows.has('solitaire')}
        onClose={() => closeWindow('solitaire')}
        title={WINDOW_META.solitaire.title}
        icon={WINDOW_META.solitaire.icon}
        width={WINDOW_META.solitaire.width}
        minHeight={WINDOW_META.solitaire.minHeight}
        defaultPosition={WINDOW_META.solitaire.position}
      >
        <SolitaireWindow />
      </Win95Window>

      <Win95Window
        id="window-recycle"
        open={openWindows.has('recycle')}
        onClose={() => closeWindow('recycle')}
        title={WINDOW_META.recycle.title}
        icon={
          recycleFull ? (
            <RecycleFull variant="16x16_4" />
          ) : (
            <RecycleEmpty variant="16x16_4" />
          )
        }
        width={WINDOW_META.recycle.width}
        minHeight={WINDOW_META.recycle.minHeight}
        defaultPosition={WINDOW_META.recycle.position}
      >
        <RecycleBinWindow />
      </Win95Window>

      {IS_DEV ? (
        <Win95Window
          id="window-devtools"
          open={openWindows.has('devtools')}
          onClose={() => closeWindow('devtools')}
          title={WINDOW_META.devtools.title}
          icon={WINDOW_META.devtools.icon}
          width={WINDOW_META.devtools.width}
          minHeight={WINDOW_META.devtools.minHeight}
          defaultPosition={WINDOW_META.devtools.position}
        >
          <DevToolsWindow />
        </Win95Window>
      ) : null}

      {adminReady ? (
        <>
          <Win95Window
            id="window-admin-panel"
            open={openWindows.has('admin-panel')}
            onClose={() => closeWindow('admin-panel')}
            title={WINDOW_META['admin-panel'].title}
            icon={WINDOW_META['admin-panel'].icon}
            width={WINDOW_META['admin-panel'].width}
            minHeight={WINDOW_META['admin-panel'].minHeight}
            defaultPosition={WINDOW_META['admin-panel'].position}
            className={WINDOW_META['admin-panel'].className}
          >
            <AdminControlPanel apps={panelApps} />
          </Win95Window>

          <Win95Window
            id="window-admin-register"
            open={openWindows.has('admin-register')}
            onClose={() => closeWindow('admin-register')}
            title={WINDOW_META['admin-register'].title}
            icon={WINDOW_META['admin-register'].icon}
            width={WINDOW_META['admin-register'].width}
            minHeight={WINDOW_META['admin-register'].minHeight}
            defaultPosition={WINDOW_META['admin-register'].position}
            maximizable
          >
            <RegisterCouponWindow />
          </Win95Window>

          <Win95Window
            id="window-admin-members"
            open={openWindows.has('admin-members')}
            onClose={() => closeWindow('admin-members')}
            title={WINDOW_META['admin-members'].title}
            icon={WINDOW_META['admin-members'].icon}
            width={WINDOW_META['admin-members'].width}
            height={WINDOW_META['admin-members'].height}
            minHeight={WINDOW_META['admin-members'].minHeight}
            defaultPosition={WINDOW_META['admin-members'].position}
            className={WINDOW_META['admin-members'].className}
            maximizable
          >
            <AdminMembersPage />
          </Win95Window>

          <Win95Window
            id="window-admin-meny"
            open={openWindows.has('admin-meny')}
            onClose={() => closeWindow('admin-meny')}
            title={WINDOW_META['admin-meny'].title}
            icon={WINDOW_META['admin-meny'].icon}
            width={WINDOW_META['admin-meny'].width}
            height={WINDOW_META['admin-meny'].height}
            minHeight={WINDOW_META['admin-meny'].minHeight}
            defaultPosition={WINDOW_META['admin-meny'].position}
            className={WINDOW_META['admin-meny'].className}
            maximizable
          >
            <AdminMenyPage />
          </Win95Window>

          <Win95Window
            id="window-admin-organization"
            open={openWindows.has('admin-organization')}
            onClose={() => closeWindow('admin-organization')}
            title={WINDOW_META['admin-organization'].title}
            icon={WINDOW_META['admin-organization'].icon}
            width={WINDOW_META['admin-organization'].width}
            minHeight={WINDOW_META['admin-organization'].minHeight}
            defaultPosition={WINDOW_META['admin-organization'].position}
            className={WINDOW_META['admin-organization'].className}
          >
            <AdminOrganizationPage />
          </Win95Window>

          <Win95Window
            id="window-admin-papirkurv"
            open={openWindows.has('admin-papirkurv')}
            onClose={() => closeWindow('admin-papirkurv')}
            title={WINDOW_META['admin-papirkurv'].title}
            icon={WINDOW_META['admin-papirkurv'].icon}
            width={WINDOW_META['admin-papirkurv'].width}
            minHeight={WINDOW_META['admin-papirkurv'].minHeight}
            defaultPosition={WINDOW_META['admin-papirkurv'].position}
          >
            <AdminPapirkurvPage />
          </Win95Window>

          <Win95Window
            id="window-admin-users"
            open={openWindows.has('admin-users')}
            onClose={() => closeWindow('admin-users')}
            title={WINDOW_META['admin-users'].title}
            icon={WINDOW_META['admin-users'].icon}
            width={WINDOW_META['admin-users'].width}
            minHeight={WINDOW_META['admin-users'].minHeight}
            defaultPosition={WINDOW_META['admin-users'].position}
            className={WINDOW_META['admin-users'].className}
          >
            <AdminUsersPage />
          </Win95Window>

          <Win95Window
            id="window-admin-status"
            open={openWindows.has('admin-status')}
            onClose={() => closeWindow('admin-status')}
            title={WINDOW_META['admin-status'].title}
            icon={WINDOW_META['admin-status'].icon}
            width={WINDOW_META['admin-status'].width}
            minHeight={WINDOW_META['admin-status'].minHeight}
            defaultPosition={WINDOW_META['admin-status'].position}
          >
            <AdminStatusPage />
          </Win95Window>

          <Win95Window
            id="window-admin-welcome"
            open={openWindows.has('admin-welcome')}
            onClose={() => closeWindow('admin-welcome')}
            title={WINDOW_META['admin-welcome'].title}
            icon={WINDOW_META['admin-welcome'].icon}
            width={WINDOW_META['admin-welcome'].width}
            minHeight={WINDOW_META['admin-welcome'].minHeight}
            defaultPosition={WINDOW_META['admin-welcome'].position}
          >
            <AdminWelcomeTour
              onClose={() => closeWindow('admin-welcome')}
            />
          </Win95Window>
        </>
      ) : null}
    </div>
  )
}
