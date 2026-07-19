import { Button, Frame, Input, Tab, Tabs } from '@react95/core'
import { Keys, User } from '@react95/icons'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '#/app/providers/AuthProvider'
import { SUPABASE_NOT_CONFIGURED_MESSAGE, supabase } from '#/shared/api/supabase'
import { fetchIsAdmin } from '#/shared/auth/require-admin'
import { postAuthRedirectTarget } from '#/shared/auth/redirect-after-login'
import { Win95InlineAlert } from '#/shared/ui/Win95InlineAlert'
import { Win95StatusGroup } from '#/shared/ui/Win95StatusGroup'

type LoginWindowProps = {
  redirect?: string
  onClose?: () => void
  /** Called after successful auth when staying on the same desktop. */
  onAuthed?: (isAdmin: boolean) => void
}

export function LoginWindow({
  redirect,
  onClose,
  onAuthed,
}: LoginWindowProps) {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [tab, setTab] = useState('signin')

  const { data: isAdmin = false, isLoading: adminLoading } = useQuery({
    queryKey: ['auth', 'is-admin', user?.id ?? '__none__'],
    enabled: !!user?.id,
    queryFn: () => fetchIsAdmin(user!.id),
  })

  async function afterAuthNavigate() {
    if (!supabase) {
      setError(SUPABASE_NOT_CONFIGURED_MESSAGE)
      return
    }

    const {
      data: { user: authedUser },
    } = await supabase.auth.getUser()

    if (!authedUser) {
      setError('Could not verify session after sign in.')
      return
    }

    const authedIsAdmin = await fetchIsAdmin(authedUser.id)
    const target = postAuthRedirectTarget(redirect, authedIsAdmin)

    // Stay on the public desktop when possible — same space, just more apps.
    if (target === '/') {
      onAuthed?.(authedIsAdmin)
      if (authedIsAdmin) {
        onClose?.()
      }
      return
    }

    onClose?.()
    void navigate({ to: target })
  }

  async function signOut() {
    setLoading(true)
    setError(null)
    setInfo(null)

    if (!supabase) {
      setLoading(false)
      setError(SUPABASE_NOT_CONFIGURED_MESSAGE)
      return
    }

    const { error: signOutError } = await supabase.auth.signOut()
    setLoading(false)

    if (signOutError) {
      setError(signOutError.message)
    }
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    if (!supabase) {
      setLoading(false)
      setError(SUPABASE_NOT_CONFIGURED_MESSAGE)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      return
    }

    await afterAuthNavigate()
    setLoading(false)
  }

  async function signUp(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    if (password !== confirmPassword) {
      setLoading(false)
      setError('Passwords do not match.')
      return
    }

    if (!supabase) {
      setLoading(false)
      setError(SUPABASE_NOT_CONFIGURED_MESSAGE)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    if (!data.session) {
      setLoading(false)
      setInfo(
        'Check your email to confirm your account, then sign in here.',
      )
      setConfirmPassword('')
      setTab('signin')
      return
    }

    await afterAuthNavigate()
    setLoading(false)
  }

  if (authLoading || (user && adminLoading)) {
    return (
      <Win95StatusGroup legend="Status">
        Henter…
      </Win95StatusGroup>
    )
  }

  if (user) {
    let signedInStatusTitle: string | null = null
    let signedInStatusBody = isAdmin
      ? 'Du er logget inn som administrator.'
      : 'Kontoen din venter på admin-tilgang.'

    if (loading) {
      signedInStatusBody = 'Logger ut…'
    } else if (error) {
      signedInStatusTitle = 'Noe gikk galt'
      signedInStatusBody = error
    }

    if (!isAdmin) {
      return (
        <>
          <Frame display="flex" alignItems="flex-start" gap="$3">
            <User variant="32x32_4" width={32} height={32} />
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>
                Venter på godkjenning
              </strong>
              <p
                className="win95-muted"
                style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.4 }}
              >
                Du er logget inn, men har ikke tilgang til
                administrasjonsområdet ennå.
              </p>
            </div>
          </Frame>

          <Win95InlineAlert title="Konto">
            {user.email ?? 'Ukjent e-post'}
          </Win95InlineAlert>

          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>
            Be en eksisterende administrator om å gi deg admin-rettigheter.
            Du kan fortsatt bruke de offentlige programmene på skrivebordet.
          </p>

          <Frame display="flex" flexDirection="column" gap="$2">
            <Button
              onClick={() => void signOut()}
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Logger ut…' : 'Logg ut'}
            </Button>
            <Button onClick={onClose} style={{ width: '100%' }}>
              Tilbake til skrivebordet
            </Button>
          </Frame>

          <Win95StatusGroup legend="Status" title={signedInStatusTitle}>
            {signedInStatusBody}
          </Win95StatusGroup>
        </>
      )
    }

    return (
      <>
        <Frame display="flex" alignItems="flex-start" gap="$3">
          <Keys variant="32x32_4" width={32} height={32} />
          <div>
            <strong style={{ display: 'block', fontSize: 14 }}>Konto</strong>
            <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.4 }}>
              Du er logget inn{user.email ? ` som ${user.email}` : ''}.
            </p>
          </div>
        </Frame>
        <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
          Vil du logge ut?
        </p>
        <Frame display="flex" flexDirection="column" gap="$2">
          <Button
            onClick={() => void signOut()}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Logger ut…' : 'Logg ut'}
          </Button>
        </Frame>
        <Win95StatusGroup legend="Status" title={signedInStatusTitle}>
          {signedInStatusBody}
        </Win95StatusGroup>
      </>
    )
  }

  let statusTitle: string | null = null
  let statusBody: string =
    'Enter email and password to continue.'

  if (loading) {
    statusBody = 'Henter…'
  } else if (error) {
    statusTitle = 'Something went wrong'
    statusBody = error
  } else if (info) {
    statusTitle = 'Next step'
    statusBody = info
  }

  return (
    <>
      <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
        Create an account or sign in. Only approved administrators can open the
        administration area.
      </p>

      <Tabs
        key={tab}
        defaultActiveTab={tab === 'signin' ? 'Sign in' : 'Create account'}
      >
        <Tab title="Sign in">
          <form onSubmit={signIn}>
            <Frame display="flex" flexDirection="column" gap="$3" pt="$3">
              <div className="win95-field">
                <label htmlFor="signin-email">Email</label>
                <Input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="win95-field">
                <label htmlFor="signin-password">Password</label>
                <Input
                  id="signin-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <Button type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Working…' : 'Sign in'}
              </Button>
            </Frame>
          </form>
        </Tab>
        <Tab title="Create account">
          <form onSubmit={signUp}>
            <Frame display="flex" flexDirection="column" gap="$3" pt="$3">
              <div className="win95-field">
                <label htmlFor="signup-email">Email</label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="win95-field">
                <label htmlFor="signup-password">Password</label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Choose a password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="win95-field">
                <label htmlFor="signup-password-confirm">Repeat password</label>
                <Input
                  id="signup-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <Button type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Working…' : 'Create account'}
              </Button>
            </Frame>
          </form>
        </Tab>
      </Tabs>

      <Win95StatusGroup legend="Status" title={statusTitle}>
        {statusBody}
      </Win95StatusGroup>
    </>
  )
}
