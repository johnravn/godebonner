import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '#/features/home/LandingPage'

type HomeSearch = {
  open?: string
  redirect?: string
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    open: typeof search.open === 'string' ? search.open : undefined,
    redirect:
      typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: HomeRoute,
})

function HomeRoute() {
  const search = Route.useSearch()
  return <LandingPage search={search} />
}
