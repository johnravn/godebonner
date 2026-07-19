import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/account')({
  // Session lives in the browser; mirror /login onto the public desktop.
  ssr: false,
  component: AccountRoute,
})

function AccountRoute() {
  return (
    <Navigate
      to="/"
      search={{ open: 'account' }}
      replace
    />
  )
}
