import { redirect } from '@tanstack/react-router'
import { getSupabase } from '#/shared/api/supabase'

/** DB-backed admin flag for `auth.uid()` (RPC definer read + RLS-safe). */
async function readIsCurrentUserAdminForUid(userId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('is_current_user_admin')
  if (!error && typeof data === 'boolean') {
    return data
  }

  const { data: profile, error: selectError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (selectError) return false
  return profile?.is_admin === true
}

export async function requireAdmin({
  location,
}: {
  location: { href: string }
}) {
  const supabase = getSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw redirect({
      to: '/login',
      search: { redirect: location.href },
    })
  }

  const isAdmin = await readIsCurrentUserAdminForUid(user.id)
  if (!isAdmin) {
    throw redirect({
      to: '/',
      search: { open: 'account' },
    })
  }

  return { user, profile: { is_admin: true as const } }
}

export async function fetchIsAdmin(userId: string) {
  const supabase = getSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user || user.id !== userId) return false

  return readIsCurrentUserAdminForUid(user.id)
}
