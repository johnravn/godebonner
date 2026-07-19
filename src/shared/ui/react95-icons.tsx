import type { CSSProperties } from 'react'
import { getSupabase, hasSupabaseBrowserConfig } from '#/shared/api/supabase'
import type { CustomIconValue } from '#/shared/ui/custom-icon'
import {
  CUSTOM_ICON_PREFIX,
  ICONS_BUCKET,
  isCustomIconValue,
  parseCustomIconPath,
  toCustomIconValue,
} from '#/shared/ui/custom-icon'
import type {
  React95IconCategory,
  React95IconEntry,
} from '#/shared/ui/react95-icon-catalog'
import { REACT95_ICON_CATALOG } from '#/shared/ui/react95-icon-catalog'

export type { React95IconCategory, React95IconEntry, CustomIconValue }
export {
  CUSTOM_ICON_PREFIX,
  ICONS_BUCKET,
  isCustomIconValue,
  parseCustomIconPath,
  toCustomIconValue,
}

export const REACT95_DEFAULT_ICON = 'FileText'
export const REACT95_FOLDER_ICON = 'Folder'
export const REACT95_MENU_ICON = 'Notepad'

export type React95IconId = string

export const REACT95_ICONS: React95IconEntry[] = REACT95_ICON_CATALOG

export const REACT95_ICON_CATEGORY_ORDER: React95IconCategory[] = [
  'files',
  'programs',
  'shell',
  'internet',
  'media',
  'mail',
  'tools',
  'other',
]

export const REACT95_ICON_CATEGORY_LABELS: Record<React95IconCategory, string> =
  {
    files: 'Filer og mapper',
    programs: 'Programmer',
    shell: 'Skrivebord og system',
    internet: 'Internett og nettverk',
    media: 'Multimedier',
    mail: 'E-post og brukere',
    tools: 'Verktøy',
    other: 'Annet',
  }

const ICON_FILE_BY_ID = new Map(
  REACT95_ICON_CATALOG.map((entry) => [entry.id, entry.file]),
)

export function isReact95IconId(value: string): boolean {
  return ICON_FILE_BY_ID.has(value)
}

/** Catalog id or uploaded `custom:` path — safe to keep when editing. */
export function isPersistedIconValue(value: string): boolean {
  return isCustomIconValue(value) || isReact95IconId(value)
}

export function coerceIconValue(value: string, fallback: string): string {
  return isPersistedIconValue(value) ? value : fallback
}

function customIconSrc(storagePath: string): string {
  if (!hasSupabaseBrowserConfig) return ''
  try {
    const { data } = getSupabase()
      .storage.from(ICONS_BUCKET)
      .getPublicUrl(storagePath)
    return data.publicUrl
  } catch {
    return ''
  }
}

export function react95IconSrc(
  icon: string,
  fallback = REACT95_DEFAULT_ICON,
): string {
  const customPath = parseCustomIconPath(icon)
  if (customPath) {
    return customIconSrc(customPath)
  }

  const file =
    ICON_FILE_BY_ID.get(icon) ??
    ICON_FILE_BY_ID.get(fallback) ??
    'FileText_32x32_4.png'
  return `/react95-icons/${file}`
}

export function React95Icon({
  icon,
  size = 32,
  fallback = REACT95_DEFAULT_ICON,
  style,
  className,
}: {
  icon: string
  size?: number
  fallback?: string
  style?: CSSProperties
  className?: string
}) {
  const src = react95IconSrc(icon, fallback)
  const resolved =
    src || react95IconSrc(fallback, REACT95_DEFAULT_ICON)

  return (
    <img
      src={resolved}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      loading="lazy"
      className={className}
      style={{ imageRendering: 'pixelated', ...style }}
      suppressHydrationWarning
    />
  )
}
