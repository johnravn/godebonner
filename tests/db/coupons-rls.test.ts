import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { normalizeMemberPhone } from '../../src/shared/lib/phone'
import type { Database } from '../../src/shared/types/database.types'

const url = process.env.SUPABASE_URL ?? process.env.API_URL ?? 'http://127.0.0.1:54321'
const anonKey =
  process.env.SUPABASE_ANON_KEY ??
  process.env.ANON_KEY ??
  process.env.PUBLISHABLE_KEY

if (!anonKey) {
  throw new Error(
    'Missing SUPABASE_ANON_KEY / ANON_KEY. Run: eval "$(supabase status -o env)" && npm run test:db',
  )
}

function anonClient() {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function authedClient(email: string, password: string) {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

describe('DB / RLS / RPC (local Supabase)', () => {
  let admin: SupabaseClient<Database>
  let member: SupabaseClient<Database>
  let anon: SupabaseClient<Database>

  beforeAll(async () => {
    anon = anonClient()
    admin = await authedClient('admin@test.local', 'password123')
    member = await authedClient('member@test.local', 'password123')
  })

  describe('normalize_member_phone parity', () => {
    const cases = [
      '',
      '91234567',
      '912 34 567',
      '4791234567',
      '04791234567',
      '+47 912 34 567',
    ]

    it.each(cases)('matches TS for %j', async (input) => {
      const { data, error } = await anon.rpc('normalize_member_phone', {
        input,
      })
      // anon may not have execute — fall back via get_coupons path or service
      if (error) {
        const { data: adminData, error: adminError } = await admin.rpc(
          'normalize_member_phone',
          { input },
        )
        expect(adminError).toBeNull()
        expect(adminData).toBe(normalizeMemberPhone(input))
        return
      }
      expect(data).toBe(normalizeMemberPhone(input))
    })
  })

  describe('get_coupons_by_phone', () => {
    it('returns not_found for unknown phones', async () => {
      const { data, error } = await anon.rpc('get_coupons_by_phone', {
        p_phone: '91111111',
      })
      expect(error).toBeNull()
      expect(data).toMatchObject({ status: 'not_found' })
    })

    it('returns unpaid member with zero coupons', async () => {
      const { data, error } = await anon.rpc('get_coupons_by_phone', {
        p_phone: '90000000',
      })
      expect(error).toBeNull()
      expect(data).toMatchObject({
        status: 'ok',
        paid: false,
        coupons_remaining: 0,
      })
    })

    it('returns paid member with unused slot count', async () => {
      const { data, error } = await anon.rpc('get_coupons_by_phone', {
        p_phone: '47 912 34 567',
      })
      expect(error).toBeNull()
      expect(data).toMatchObject({
        status: 'ok',
        paid: true,
        first_name: 'Paid',
      })
      const remaining = (data as { coupons_remaining: number }).coupons_remaining
      expect(remaining).toBeGreaterThanOrEqual(1)
      expect(remaining).toBeLessThanOrEqual(3)
    })

    it('returns multiple candidates when several members share a phone', async () => {
      const sharedPhone = '98887766'
      const twinAlphaId = '33333333-3333-3333-3333-333333333333'
      const twinBetaId = '44444444-4444-4444-4444-444444444444'

      const { error: insertError } = await admin.from('members').insert([
        {
          id: twinAlphaId,
          first_name: 'Twin',
          last_name: 'Alpha',
          phone: sharedPhone,
          paid: true,
          external_id: 'dup-alpha',
        },
        {
          id: twinBetaId,
          first_name: 'Twin',
          last_name: 'Beta',
          phone: sharedPhone,
          paid: false,
          external_id: 'dup-beta',
        },
      ])
      expect(insertError).toBeNull()

      const { data, error } = await anon.rpc('get_coupons_by_phone', {
        p_phone: sharedPhone,
      })
      expect(error).toBeNull()
      expect(data).toMatchObject({ status: 'multiple' })
      const candidates = (
        data as {
          candidates: Array<{
            member_id: string
            first_name: string
            last_name: string
          }>
        }
      ).candidates
      expect(candidates.length).toBeGreaterThanOrEqual(2)
      expect(candidates.some((c) => c.last_name === 'Alpha')).toBe(true)
      expect(candidates.some((c) => c.last_name === 'Beta')).toBe(true)

      const { data: picked, error: pickError } = await anon.rpc(
        'get_coupons_by_phone',
        {
          p_phone: sharedPhone,
          p_member_id: twinAlphaId,
        },
      )
      expect(pickError).toBeNull()
      expect(picked).toMatchObject({
        status: 'ok',
        paid: true,
        first_name: 'Twin',
      })

      // Cleanup so re-runs stay deterministic
      await admin.from('members').delete().eq('phone', sharedPhone)
    })
  })

  describe('RLS', () => {
    it('blocks anon from selecting members', async () => {
      const { data, error } = await anon.from('members').select('id').limit(1)
      // No GRANT to anon → permission denied; or GRANT + RLS → [] with null error
      if (error) {
        expect(error.code).toBe('42501')
        return
      }
      expect(data ?? []).toEqual([])
    })

    it('allows admin to select members', async () => {
      const { data, error } = await admin.from('members').select('id, phone')
      expect(error).toBeNull()
      expect(data?.length).toBeGreaterThan(0)
    })

    it('blocks non-admin from selecting members', async () => {
      const { data, error } = await member.from('members').select('id').limit(1)
      expect(error).toBeNull()
      expect(data ?? []).toEqual([])
    })

    it('allows anon to read recycle_bin_items and live menus', async () => {
      const recycle = await anon.from('recycle_bin_items').select('id, name')
      expect(recycle.error).toBeNull()
      expect(recycle.data?.some((r) => r.name === 'Test papirkurv')).toBe(true)

      const menus = await anon.from('menus').select('id, name, is_live')
      expect(menus.error).toBeNull()
      expect(menus.data?.every((m) => m.is_live)).toBe(true)
    })

    it('blocks non-admin from inserting recycle_bin_items', async () => {
      const { error } = await member.from('recycle_bin_items').insert({
        name: 'Should fail',
      })
      expect(error).toBeTruthy()
    })

    it('allows anon to read organization_settings', async () => {
      const { data, error } = await anon
        .from('organization_settings')
        .select('coupons_per_year')
        .maybeSingle()
      expect(error).toBeNull()
      expect(data?.coupons_per_year).toBeGreaterThanOrEqual(1)
    })
  })

  describe('admin coupon RPCs', () => {
    it('forbids non-admin from using coupons', async () => {
      const { data, error } = await member.rpc('admin_use_member_coupon', {
        p_member_id: '11111111-1111-1111-1111-111111111111',
      })
      expect(error).toBeNull()
      expect(data).toMatchObject({ status: 'forbidden' })
    })

    it('lets admin use and unuse a coupon', async () => {
      const { data: before } = await admin
        .from('member_coupons')
        .select('id, used_at')
        .eq('member_id', '11111111-1111-1111-1111-111111111111')
        .is('used_at', null)
        .limit(1)
        .maybeSingle()

      expect(before?.id).toBeTruthy()

      const { data: used, error: useError } = await admin.rpc(
        'admin_use_member_coupon',
        {
          p_member_id: '11111111-1111-1111-1111-111111111111',
          p_coupon_id: before!.id,
        },
      )
      expect(useError).toBeNull()
      expect(used).toMatchObject({ status: 'ok' })

      const { data: unused, error: unuseError } = await admin.rpc(
        'admin_unuse_member_coupon',
        { p_coupon_id: before!.id },
      )
      expect(unuseError).toBeNull()
      expect(unused).toMatchObject({ status: 'ok' })
    })

    it('logs payment status changes from admin_set_member_paid', async () => {
      const memberId = '22222222-2222-2222-2222-222222222222'

      const { data: setPaid, error: setError } = await admin.rpc(
        'admin_set_member_paid',
        { p_member_id: memberId, p_paid: true },
      )
      expect(setError).toBeNull()
      expect(setPaid).toMatchObject({ status: 'ok' })

      const { data: logs, error: logError } = await admin
        .from('member_payment_change_log')
        .select(
          'member_id, paid, previous_paid, changed_by_email, member_first_name, member_last_name, year',
        )
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(1)
      expect(logError).toBeNull()
      expect(logs?.[0]).toMatchObject({
        member_id: memberId,
        paid: true,
        previous_paid: false,
        changed_by_email: 'admin@test.local',
        member_first_name: 'Unpaid',
        member_last_name: 'Member',
      })
      expect(logs?.[0]?.year).toBe(new Date().getFullYear())

      // Restore unpaid so other tests stay deterministic
      await admin.rpc('admin_set_member_paid', {
        p_member_id: memberId,
        p_paid: false,
      })
    })
  })
})
