/**
 * Apply post-login navigation: never send users to admin URLs from `redirect`.
 * Auth stays on the public desktop (`/`) so it feels like the same space.
 */
export function postAuthRedirectTarget(
  redirect: string | undefined,
  _isAdmin: boolean,
): string {
  const raw = redirect?.trim()
  if (!raw?.startsWith('/')) {
    return '/'
  }

  const path = raw.split('?')[0] ?? raw
  if (
    path.startsWith('/admin') ||
    path === '/account' ||
    path === '/login'
  ) {
    return '/'
  }

  return path
}
