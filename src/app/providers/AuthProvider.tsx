import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '#/shared/api/supabase'
import type { Session, User } from '@supabase/supabase-js'

type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthCtx = React.createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = React.useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  })

  const previousUserIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const client = supabase
    if (!client) {
      setState({ session: null, user: null, loading: false })
      return
    }

    const authClient = client

    let mounted = true

    async function init() {
      try {
        const { data, error } = await authClient.auth.getSession()
        if (!mounted) return
        if (error) {
          await authClient.auth.signOut({ scope: 'local' })
          previousUserIdRef.current = null
          queryClient.setQueryData(['auth', 'user'], null)
          setState({ session: null, user: null, loading: false })
          return
        }
        previousUserIdRef.current = data.session?.user.id ?? null
        queryClient.setQueryData(['auth', 'user'], data.session?.user ?? null)
        setState({
          session: data.session,
          user: data.session?.user ?? null,
          loading: false,
        })
      } catch {
        if (!mounted) return
        await authClient.auth.signOut({ scope: 'local' }).catch(() => {})
        previousUserIdRef.current = null
        queryClient.setQueryData(['auth', 'user'], null)
        setState({ session: null, user: null, loading: false })
      }
    }

    init()

    const { data: sub } = authClient.auth.onAuthStateChange((event, session) => {
      const currentUserId = session?.user.id ?? null
      queryClient.setQueryData(['auth', 'user'], session?.user ?? null)

      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })
        void queryClient.invalidateQueries({ queryKey: ['auth', 'is-admin'] })
      }

      if (
        event === 'SIGNED_OUT' ||
        (previousUserIdRef.current &&
          previousUserIdRef.current !== currentUserId)
      ) {
        queryClient.clear()
        queryClient.setQueryData(['auth', 'user'], null)
      }

      previousUserIdRef.current = currentUserId
      setState({ session, user: session?.user ?? null, loading: false })
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [queryClient])

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return React.useContext(AuthCtx)
}
