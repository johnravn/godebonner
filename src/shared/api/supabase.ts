import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#/shared/types/database.types'

/** Publishable (preferred) or legacy anon public key — same Supabase role. */
export function readSupabaseClientKeyFromEnv(): string {
  const publishable =
    typeof import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string'
      ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY.trim()
      : ''
  const anon =
    typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string'
      ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim()
      : ''
  return publishable || anon
}

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local (optional legacy: VITE_SUPABASE_ANON_KEY). See .env.example.'

const supabaseUrl =
  typeof import.meta.env.VITE_SUPABASE_URL === 'string'
    ? import.meta.env.VITE_SUPABASE_URL.trim()
    : ''
const supabaseClientKey = readSupabaseClientKeyFromEnv()

/** True when URL and a client key (publishable or legacy anon) are present — matches client init rules. */
export const hasSupabaseBrowserConfig = Boolean(supabaseUrl && supabaseClientKey)

const authOptions = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
  flowType: 'pkce' as const,
}

export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabaseClientKey
    ? createClient<Database>(supabaseUrl, supabaseClientKey, {
        auth: authOptions,
      })
    : null

/** Throws if Supabase env is missing — use inside handlers after the app shell has rendered. */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE)
  }
  return supabase
}

/** Browser Supabase client — alias of {@link getSupabase}. */
export const getSupabaseBrowserClient = getSupabase
