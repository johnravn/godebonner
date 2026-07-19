import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CouponLookupWindow } from './CouponLookupWindow'
import { createRpcMock } from '#/test/mock-supabase'
import { renderWithProviders } from '#/test/test-utils'

const rpcMock = createRpcMock({})

vi.mock('#/shared/api/supabase', () => ({
  getSupabase: () => rpcMock,
}))

describe('CouponLookupWindow', () => {
  beforeEach(() => {
    rpcMock.rpc.mockReset()
  })

  it('shows not-found message for unknown phones', async () => {
    const user = userEvent.setup()
    rpcMock.rpc.mockResolvedValue({
      data: { status: 'not_found' },
      error: null,
    })

    renderWithProviders(<CouponLookupWindow />)
    await user.type(screen.getByLabelText(/telefonnummer/i), '91234567')
    await user.click(screen.getByRole('button', { name: /se kuponger/i }))

    await waitFor(() => {
      expect(screen.getByText(/fant ingen medlem/i)).toBeInTheDocument()
    })
    expect(rpcMock.rpc).toHaveBeenCalledWith('get_coupons_by_phone', {
      p_phone: '91234567',
    })
  })

  it('shows remaining coupons for a paid member', async () => {
    const user = userEvent.setup()
    rpcMock.rpc.mockResolvedValue({
      data: {
        status: 'ok',
        paid: true,
        coupons_remaining: 2,
        first_name: 'Ada',
        coupons: [
          { used: false, used_at: null },
          { used: false, used_at: null },
          { used: true, used_at: '2026-01-01T12:00:00Z' },
        ],
      },
      error: null,
    })

    renderWithProviders(<CouponLookupWindow />)
    await user.type(screen.getByLabelText(/telefonnummer/i), '91234567')
    await user.click(screen.getByRole('button', { name: /se kuponger/i }))

    await waitFor(() => {
      expect(screen.getByText(/Hei, Ada!/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/2 kuponger igjen/i)).toBeInTheDocument()
    expect(screen.getByText(/Kuponger \(2 ubrukte\)/i)).toBeInTheDocument()
  })

  it('shows unpaid messaging', async () => {
    const user = userEvent.setup()
    rpcMock.rpc.mockResolvedValue({
      data: {
        status: 'ok',
        paid: false,
        coupons_remaining: 0,
        first_name: 'Ola',
        coupons: [],
      },
      error: null,
    })

    renderWithProviders(<CouponLookupWindow />)
    await user.type(screen.getByLabelText(/telefonnummer/i), '90000000')
    await user.click(screen.getByRole('button', { name: /se kuponger/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/har ikke betalt i år/i),
      ).toBeInTheDocument()
    })
  })

  it('shows error when RPC fails', async () => {
    const user = userEvent.setup()
    rpcMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'network down' },
    })

    renderWithProviders(<CouponLookupWindow />)
    await user.type(screen.getByLabelText(/telefonnummer/i), '91234567')
    await user.click(screen.getByRole('button', { name: /se kuponger/i }))

    await waitFor(() => {
      expect(screen.getByText(/noe gikk galt/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/network down/i)).toBeInTheDocument()
  })

  it('lets the user pick which member when several share a phone', async () => {
    const user = userEvent.setup()
    rpcMock.rpc
      .mockResolvedValueOnce({
        data: {
          status: 'multiple',
          candidates: [
            {
              member_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              first_name: 'Ada',
              last_name: 'Lovelace',
            },
            {
              member_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              first_name: 'Bob',
              last_name: 'Shared',
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          status: 'ok',
          paid: true,
          coupons_remaining: 1,
          first_name: 'Ada',
          coupons: [{ used: false, used_at: null }],
        },
        error: null,
      })

    renderWithProviders(<CouponLookupWindow />)
    await user.type(screen.getByLabelText(/telefonnummer/i), '91234567')
    await user.click(screen.getByRole('button', { name: /se kuponger/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/flere medlemmer har dette nummeret/i),
      ).toBeInTheDocument()
    })
    expect(screen.getByText(/hvilket medlem vil du se/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ada lovelace/i }))

    await waitFor(() => {
      expect(screen.getByText(/Hei, Ada!/i)).toBeInTheDocument()
    })
    expect(rpcMock.rpc).toHaveBeenLastCalledWith('get_coupons_by_phone', {
      p_phone: '91234567',
      p_member_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
  })
})
