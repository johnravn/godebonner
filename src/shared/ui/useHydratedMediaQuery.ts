import { useEffect, useState } from 'react'
import { useMediaQuery } from '#/shared/ui/useMediaQuery'

/** Media query that is false during SSR and the first client render (avoids hydration mismatch). */
export function useHydratedMediaQuery(query: string): boolean {
  const [hydrated, setHydrated] = useState(false)
  const matches = useMediaQuery(query)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated && matches
}
