import type { PixelateIconOptions } from '#/shared/lib/pixelate-icon'
import type { Tables } from '#/shared/types/database.types'
import type { CustomIconValue } from '#/shared/ui/custom-icon'
import { getSupabase } from '#/shared/api/supabase'
import {
  ICON_UPLOAD_MAX_BYTES,
  ICON_UPLOAD_MIME_TYPES,
  IconUploadError,
  normalizeEmojiInput,
  processEmojiIcon,
  processIconUpload,
} from '#/shared/lib/pixelate-icon'
import {
  ICONS_BUCKET,
  parseCustomIconPath,
  toCustomIconValue,
} from '#/shared/ui/custom-icon'

export { ICONS_BUCKET }

export type UploadCustomIconOptions = PixelateIconOptions & {
  /** Optional display name; defaults to the file name without extension. */
  name?: string
}

export type CustomIconRow = Tables<'custom_icons'>

function defaultIconName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim()
  return base || 'Ikon'
}

async function requireAuthedUserId(): Promise<string> {
  const supabase = getSupabase()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new IconUploadError('Du må være innlogget for å laste opp ikoner.')
  }

  return user.id
}

/**
 * Upload an already-processed 64×64 PNG and register it in `custom_icons`.
 */
async function uploadProcessedIconBlob(
  blob: Blob,
  options: { name: string; pixelated: boolean },
): Promise<CustomIconValue> {
  const userId = await requireAuthedUserId()
  const supabase = getSupabase()
  const path = `${userId}/${crypto.randomUUID()}.png`

  const { error: uploadError } = await supabase.storage
    .from(ICONS_BUCKET)
    .upload(path, blob, {
      contentType: 'image/png',
      upsert: false,
      cacheControl: '31536000',
    })

  if (uploadError) {
    throw new IconUploadError(
      uploadError.message || 'Opplasting feilet. Prøv igjen.',
    )
  }

  const name = options.name.trim().slice(0, 80) || 'Ikon'

  const { error: insertError } = await supabase.from('custom_icons').insert({
    storage_path: path,
    name,
    pixelated: options.pixelated,
    created_by: userId,
  })

  if (insertError) {
    // Best-effort cleanup so orphans don't accumulate on registry failure.
    await supabase.storage.from(ICONS_BUCKET).remove([path])
    throw new IconUploadError(
      insertError.message || 'Kunne ikke lagre ikonet i biblioteket.',
    )
  }

  return toCustomIconValue(path)
}

/**
 * Process and upload a custom icon, then register it in `custom_icons`
 * so it can be reused later. Returns a `custom:<path>` value.
 */
export async function uploadCustomIcon(
  file: File,
  options: UploadCustomIconOptions = {},
): Promise<CustomIconValue> {
  if (!ICON_UPLOAD_MIME_TYPES.has(file.type)) {
    throw new IconUploadError(
      'Ugyldig filtype. Bruk PNG, JPEG, WebP eller GIF.',
    )
  }
  if (file.size > ICON_UPLOAD_MAX_BYTES) {
    throw new IconUploadError('Filen er for stor. Maks størrelse er 2 MB.')
  }

  const pixelate = options.pixelate !== false
  const blob = await processIconUpload(file, { pixelate })
  const name = options.name ?? defaultIconName(file.name)

  return uploadProcessedIconBlob(blob, { name, pixelated: pixelate })
}

/**
 * Rasterize an emoji (optionally Win95-pixelated), upload, and register it.
 */
export async function uploadEmojiIcon(
  rawEmoji: string,
  options: UploadCustomIconOptions = {},
): Promise<CustomIconValue> {
  const emoji = normalizeEmojiInput(rawEmoji)
  const pixelate = options.pixelate !== false
  const blob = await processEmojiIcon(emoji, { pixelate })
  const name = options.name ?? `Emoji ${emoji}`

  return uploadProcessedIconBlob(blob, { name, pixelated: pixelate })
}

/** List saved custom icons for the admin picker library (newest first). */
export async function listCustomIcons(): Promise<CustomIconRow[]> {
  const { data, error } = await getSupabase()
    .from('custom_icons')
    .select('id, storage_path, name, pixelated, created_by, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    throw new IconUploadError(
      error.message || 'Kunne ikke hente lagrede ikoner.',
    )
  }

  return data
}

/** Remove a saved custom icon from the library and storage. */
export async function deleteCustomIcon(row: CustomIconRow): Promise<void> {
  const supabase = getSupabase()

  const { error: deleteError } = await supabase
    .from('custom_icons')
    .delete()
    .eq('id', row.id)

  if (deleteError) {
    throw new IconUploadError(
      deleteError.message || 'Kunne ikke slette ikonet.',
    )
  }

  const { error: storageError } = await supabase.storage
    .from(ICONS_BUCKET)
    .remove([row.storage_path])

  if (storageError) {
    // Row is already gone; surface storage cleanup failure without rolling back.
    throw new IconUploadError(
      storageError.message || 'Ikonet ble fjernet fra biblioteket, men filen ble ikke slettet.',
    )
  }
}

export function customIconRowValue(row: CustomIconRow): CustomIconValue {
  return toCustomIconValue(row.storage_path)
}

/** Resolve a storage path to a public URL for the icons bucket. */
export function customIconPublicUrl(storagePath: string): string {
  const { data } = getSupabase()
    .storage.from(ICONS_BUCKET)
    .getPublicUrl(storagePath)
  return data.publicUrl
}

export function isCustomIconInLibrary(
  value: string,
  rows: CustomIconRow[],
): boolean {
  const path = parseCustomIconPath(value)
  if (!path) return false
  return rows.some((row) => row.storage_path === path)
}
