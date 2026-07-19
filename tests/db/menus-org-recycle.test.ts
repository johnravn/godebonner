import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/shared/types/database.types'

const url = process.env.SUPABASE_URL ?? process.env.API_URL ?? 'http://127.0.0.1:54321'
const anonKey =
  process.env.SUPABASE_ANON_KEY ??
  process.env.ANON_KEY ??
  process.env.PUBLISHABLE_KEY

if (!anonKey) {
  throw new Error('Missing SUPABASE_ANON_KEY for DB tests')
}

describe('menus / org / recycle_bin RLS', () => {
  let anon: ReturnType<typeof createClient<Database>>
  let admin: ReturnType<typeof createClient<Database>>
  let member: ReturnType<typeof createClient<Database>>

  beforeAll(async () => {
    anon = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    admin = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    member = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await admin.auth.signInWithPassword({
      email: 'admin@test.local',
      password: 'password123',
    })
    await member.auth.signInWithPassword({
      email: 'member@test.local',
      password: 'password123',
    })
  })

  it('lets anon read live menus and recycle bin', async () => {
    const menus = await anon.from('menus').select('name, is_live')
    expect(menus.error).toBeNull()
    expect(menus.data?.some((m) => m.is_live && m.name === 'Test meny')).toBe(
      true,
    )

    const recycle = await anon.from('recycle_bin_items').select('name')
    expect(recycle.error).toBeNull()
    expect(recycle.data?.some((r) => r.name === 'Test papirkurv')).toBe(true)
  })

  it('hides live menus from anon when public_menu_enabled is false', async () => {
    const { error: disableError } = await admin
      .from('organization_settings')
      .update({ public_menu_enabled: false })
      .eq('id', true)
    expect(disableError).toBeNull()

    try {
      const menus = await anon.from('menus').select('name, is_live')
      expect(menus.error).toBeNull()
      expect(menus.data ?? []).toHaveLength(0)

      const categories = await anon.from('menu_categories').select('id')
      expect(categories.error).toBeNull()
      expect(categories.data ?? []).toHaveLength(0)
    } finally {
      const { error: enableError } = await admin
        .from('organization_settings')
        .update({ public_menu_enabled: true })
        .eq('id', true)
      expect(enableError).toBeNull()
    }
  })

  it('lets admin still read menus when public_menu_enabled is false', async () => {
    const { error: disableError } = await admin
      .from('organization_settings')
      .update({ public_menu_enabled: false })
      .eq('id', true)
    expect(disableError).toBeNull()

    try {
      const menus = await admin.from('menus').select('name, is_live')
      expect(menus.error).toBeNull()
      expect(menus.data?.some((m) => m.name === 'Test meny')).toBe(true)
    } finally {
      const { error: enableError } = await admin
        .from('organization_settings')
        .update({ public_menu_enabled: true })
        .eq('id', true)
      expect(enableError).toBeNull()
    }
  })

  it('blocks non-admin from updating organization_settings', async () => {
    const { data: before } = await anon
      .from('organization_settings')
      .select('display_name')
      .eq('id', true)
      .maybeSingle()

    const { count } = await member
      .from('organization_settings')
      .update({ display_name: 'Hacked' }, { count: 'exact' })
      .eq('id', true)
    // PostgREST often returns null error with 0 rows under RLS
    expect(count ?? 0).toBe(0)

    const { data: after } = await anon
      .from('organization_settings')
      .select('display_name')
      .eq('id', true)
      .maybeSingle()
    expect(after?.display_name).toBe(before?.display_name)
    expect(after?.display_name).not.toBe('Hacked')
  })

  it('allows admin to update organization_settings', async () => {
    const { data: before } = await admin
      .from('organization_settings')
      .select('display_name, coupons_per_year')
      .eq('id', true)
      .maybeSingle()

    const { error } = await admin
      .from('organization_settings')
      .update({ display_name: before?.display_name ?? 'Gode Bønner' })
      .eq('id', true)
    expect(error).toBeNull()
  })

  it('allows admin to insert recycle_bin_items', async () => {
    const { data, error } = await admin
      .from('recycle_bin_items')
      .insert({ name: 'E2E junk', description: 'temp', sort_order: 99 })
      .select('id')
      .maybeSingle()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) {
      await admin.from('recycle_bin_items').delete().eq('id', data.id)
    }
  })
})
