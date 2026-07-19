import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { requireAdmin } from '#/shared/auth/require-admin'

/**
 * Legacy /admin URLs redirect onto the public desktop with the matching window open.
 * Admin tools live on the same Win95 desktop as the site.
 */
export const Route = createFileRoute('/_admin')({
  ssr: false,
  beforeLoad: async (ctx) => {
    await requireAdmin(ctx)

    const path = ctx.location.pathname.replace(/\/$/, '') || '/'
    const params = new URLSearchParams(ctx.location.searchStr ?? '')
    const searchOpen = params.get('open') ?? undefined

    const openFromPath: Record<string, string> = {
      '/admin': 'admin',
      '/admin/members': 'members',
      '/admin/meny': 'admin-meny',
      '/admin/organization': 'organization',
      '/admin/papirkurv': 'papirkurv',
      '/admin/users': 'users',
      '/admin/status': 'status',
    }

    throw redirect({
      to: '/',
      search: {
        open: searchOpen ?? openFromPath[path] ?? 'admin',
      },
      replace: true,
    })
  },
  component: AdminRedirectLayout,
})

function AdminRedirectLayout() {
  return <Outlet />
}
