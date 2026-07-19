import { createFileRoute, Navigate } from '@tanstack/react-router'

type LoginSearch = {
  redirect?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect:
      typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect } = Route.useSearch()
  return (
    <Navigate
      to="/"
      search={{
        open: 'login',
        ...(redirect ? { redirect } : {}),
      }}
      replace
    />
  )
}
