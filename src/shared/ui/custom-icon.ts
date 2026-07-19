/** Supabase Storage bucket for custom uploaded icons. */
export const ICONS_BUCKET = 'icons'

export const CUSTOM_ICON_PREFIX = 'custom:' as const

export type CustomIconValue = `${typeof CUSTOM_ICON_PREFIX}${string}`

export function isCustomIconValue(value: string): value is CustomIconValue {
  return (
    value.startsWith(CUSTOM_ICON_PREFIX) &&
    value.length > CUSTOM_ICON_PREFIX.length
  )
}

export function parseCustomIconPath(value: string): string | null {
  if (!isCustomIconValue(value)) return null
  return value.slice(CUSTOM_ICON_PREFIX.length)
}

export function toCustomIconValue(storagePath: string): CustomIconValue {
  const trimmed = storagePath.replace(/^\/+/, '')
  return `${CUSTOM_ICON_PREFIX}${trimmed}`
}
