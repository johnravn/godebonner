import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginWindow } from './LoginWindow'
import { renderWithProviders } from '#/test/test-utils'

const navigate = vi.fn()
const signInWithPassword = vi.fn()
const getUser = vi.fn()
const fetchIsAdmin = vi.fn()
const useAuth = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('#/app/providers/AuthProvider', () => ({
  useAuth: () => useAuth(),
}))

vi.mock('#/shared/auth/require-admin', () => ({
  fetchIsAdmin: (...args: unknown[]) => fetchIsAdmin(...args),
}))

vi.mock('#/shared/api/supabase', () => ({
  SUPABASE_NOT_CONFIGURED_MESSAGE: 'not configured',
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      getUser: (...args: unknown[]) => getUser(...args),
      signOut: vi.fn(),
      signUp: vi.fn(),
    },
  },
}))

describe('LoginWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
      session: null,
      user: null,
      loading: false,
    })
  })

  it('shows sign-in error from Supabase', async () => {
    const user = userEvent.setup()
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })

    renderWithProviders(<LoginWindow />)
    await user.type(
      document.getElementById('signin-email') as HTMLInputElement,
      'a@b.c',
    )
    await user.type(
      document.getElementById('signin-password') as HTMLInputElement,
      'secret',
    )
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument()
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('stays on desktop after admin sign-in (does not navigate to /admin)', async () => {
    const user = userEvent.setup()
    const onAuthed = vi.fn()
    const onClose = vi.fn()
    signInWithPassword.mockResolvedValue({ error: null })
    getUser.mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'admin@example.com' } },
    })
    fetchIsAdmin.mockResolvedValue(true)

    renderWithProviders(
      <LoginWindow redirect="/admin/members" onAuthed={onAuthed} onClose={onClose} />,
    )
    await user.type(
      document.getElementById('signin-email') as HTMLInputElement,
      'admin@example.com',
    )
    await user.type(
      document.getElementById('signin-password') as HTMLInputElement,
      'secret',
    )
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(onAuthed).toHaveBeenCalledWith(true)
    })
    expect(onClose).toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
