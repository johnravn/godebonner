import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterCouponWindow } from './RegisterCouponWindow'
import { createRpcMock } from '#/test/mock-supabase'
import { renderWithProviders } from '#/test/test-utils'

const member = {
  id: 'm1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone: '91234567',
  email: 'ada@example.com',
  address: null,
  postal_code: null,
  city: null,
  birth_year: 1990,
  member_type: null,
  joined_at: null,
  paid: true,
  coupons_remaining: 2,
  last_allocation_at: '2026-01-01T00:00:00Z',
  coupons: [
    {
      id: 'c1',
      allocated_at: '2026-01-01T00:00:00Z',
      used_at: null,
    },
    {
      id: 'c2',
      allocated_at: '2026-01-01T00:00:00Z',
      used_at: null,
    },
    {
      id: 'c3',
      allocated_at: '2026-01-01T00:00:00Z',
      used_at: '2026-02-01T00:00:00Z',
    },
  ],
}

const rpcMock = createRpcMock({})

vi.mock('#/shared/api/supabase', () => ({
  getSupabase: () => rpcMock,
}))

describe('RegisterCouponWindow', () => {
  beforeEach(() => {
    rpcMock.rpc.mockReset()
  })

  it('searches members and uses a coupon', async () => {
    const user = userEvent.setup()
    rpcMock.rpc.mockImplementation(async (name: string) => {
      if (name === 'admin_search_members') {
        return {
          data: { status: 'ok', members: [member] },
          error: null,
        }
      }
      if (name === 'admin_use_member_coupon') {
        return {
          data: {
            status: 'ok',
            member: {
              ...member,
              coupons_remaining: 1,
              coupons: member.coupons.map((c) =>
                c.id === 'c1'
                  ? { ...c, used_at: '2026-07-18T12:00:00Z' }
                  : c,
              ),
            },
            coupons: member.coupons.map((c) =>
              c.id === 'c1' ? { ...c, used_at: '2026-07-18T12:00:00Z' } : c,
            ),
          },
          error: null,
        }
      }
      return { data: null, error: { message: `unexpected ${name}` } }
    })

    renderWithProviders(<RegisterCouponWindow />)
    await user.type(screen.getByLabelText(/^søk$/i), 'Ada')
    await user.click(screen.getByRole('button', { name: /^søk$/i }))

    await waitFor(() => {
      expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0)
    })
    expect(screen.getByText(/Kuponger \(2 ubrukte\)/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /kupong 1/i }))

    await waitFor(() => {
      expect(screen.getByText(/kupong brukt/i)).toBeInTheDocument()
    })
    expect(rpcMock.rpc).toHaveBeenCalledWith('admin_use_member_coupon', {
      p_member_id: 'm1',
      p_coupon_id: 'c1',
    })
  })

  it('registers payment for the year', async () => {
    const unpaid = { ...member, paid: false, coupons_remaining: 0, coupons: [] }
    const user = userEvent.setup()
    rpcMock.rpc.mockImplementation(async (name: string) => {
      if (name === 'admin_search_members') {
        return {
          data: { status: 'ok', members: [unpaid] },
          error: null,
        }
      }
      if (name === 'admin_set_member_paid') {
        return {
          data: {
            status: 'ok',
            member: { ...unpaid, paid: true, coupons_remaining: 3 },
            coupons: member.coupons.map((c) => ({ ...c, used_at: null })),
          },
          error: null,
        }
      }
      return { data: null, error: { message: `unexpected ${name}` } }
    })

    renderWithProviders(<RegisterCouponWindow />)
    await user.type(screen.getByLabelText(/^søk$/i), 'Ada')
    await user.click(screen.getByRole('button', { name: /^søk$/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /registrer betaling for i år/i }),
      ).toBeInTheDocument()
    })

    await user.click(
      screen.getByRole('button', { name: /registrer betaling for i år/i }),
    )

    await waitFor(() => {
      expect(screen.getByText(/betaling registrert/i)).toBeInTheDocument()
    })
    expect(rpcMock.rpc).toHaveBeenCalledWith('admin_set_member_paid', {
      p_member_id: 'm1',
      p_paid: true,
    })
  })
})
