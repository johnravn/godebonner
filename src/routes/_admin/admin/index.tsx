import { createFileRoute } from '@tanstack/react-router'

export type AdminSearch = {
  open?: string
}

/** Redirect handled by `/_admin` layout; this route only validates search. */
export const Route = createFileRoute('/_admin/admin/')({
  validateSearch: (search: Record<string, unknown>): AdminSearch => ({
    open: typeof search.open === 'string' ? search.open : undefined,
  }),
  component: () => null,
})
