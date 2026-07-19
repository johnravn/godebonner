import { createFileRoute } from '@tanstack/react-router'

/** Redirect handled by `/_admin` layout. */
export const Route = createFileRoute('/_admin/admin/organization')({
  component: () => null,
})
