import { Button, Checkbox, Input } from '@react95/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  customIconRowValue,
  deleteCustomIcon,
  listCustomIcons,
  uploadCustomIcon,
  uploadEmojiIcon,
} from '#/shared/api/icon-storage'
import {
  ICON_UPLOAD_ACCEPT,
  IconUploadError,
  blobPreviewUrl,
  normalizeEmojiInput,
  processEmojiIcon,
  processIconUpload,
} from '#/shared/lib/pixelate-icon'
import { Win95Select } from '#/shared/ui/Win95Select'
import type {
  React95IconCategory,
  React95IconEntry,
} from '#/shared/ui/react95-icons'
import {
  REACT95_ICONS,
  REACT95_ICON_CATEGORY_LABELS,
  REACT95_ICON_CATEGORY_ORDER,
  React95Icon,
  isCustomIconValue,
  isReact95IconId,
  toCustomIconValue,
} from '#/shared/ui/react95-icons'

type PickerMode = 'standard' | 'custom'
type PendingSource =
  | { kind: 'file'; file: File }
  | { kind: 'emoji'; emoji: string }

type React95IconPickerProps = {
  value: string
  onChange: (iconId: string) => void
  labelId?: string
  label?: string
  defaultIcon?: string
}

type CategoryFilter = 'all' | React95IconCategory

const CUSTOM_ICONS_QUERY_KEY = ['admin', 'custom-icons'] as const
const EMOJI_QUICK_PICKS = ['☕', '🥐', '🍰', '🍪', '🥛', '⭐', '❤️', '🔥'] as const

function groupByCategory(
  icons: React95IconEntry[],
): Array<{ category: React95IconCategory; icons: React95IconEntry[] }> {
  const map = new Map<React95IconCategory, React95IconEntry[]>()
  for (const entry of icons) {
    const list = map.get(entry.category)
    if (list) list.push(entry)
    else map.set(entry.category, [entry])
  }
  return REACT95_ICON_CATEGORY_ORDER.filter((category) => map.has(category)).map(
    (category) => ({
      category,
      icons: map.get(category)!,
    }),
  )
}

export function React95IconPicker({
  value,
  onChange,
  labelId = 'react95-icon-label',
  label = 'Ikon',
  defaultIcon,
}: React95IconPickerProps) {
  const fileInputId = useId()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<PickerMode>(() =>
    isCustomIconValue(value) ? 'custom' : 'standard',
  )
  const [filter, setFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [pixelate, setPixelate] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [emojiInput, setEmojiInput] = useState('')
  const [originalPreview, setOriginalPreview] = useState<string | null>(null)
  const [originalEmoji, setOriginalEmoji] = useState<string | null>(null)
  const [processedPreview, setProcessedPreview] = useState<string | null>(null)
  const [pendingSource, setPendingSource] = useState<PendingSource | null>(null)
  const originalUrlRef = useRef<string | null>(null)
  const processedUrlRef = useRef<string | null>(null)

  const {
    data: savedIcons = [],
    isPending: savedPending,
    isError: savedError,
  } = useQuery({
    queryKey: CUSTOM_ICONS_QUERY_KEY,
    queryFn: listCustomIcons,
    enabled: mode === 'custom',
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCustomIcon,
    onSuccess: (_data, deleted) => {
      void queryClient.invalidateQueries({ queryKey: CUSTOM_ICONS_QUERY_KEY })
      if (isCustomIconValue(value) && value === customIconRowValue(deleted)) {
        onChange(defaultIcon ?? '')
      }
    },
  })

  useEffect(() => {
    setMode(isCustomIconValue(value) ? 'custom' : 'standard')
  }, [value])

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'Alle' },
      ...REACT95_ICON_CATEGORY_ORDER.map((category) => ({
        value: category,
        label: REACT95_ICON_CATEGORY_LABELS[category],
      })),
    ],
    [],
  )

  const filteredIcons = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return REACT95_ICONS.filter((entry) => {
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) {
        return false
      }
      if (!q) return true
      return entry.id.toLowerCase().includes(q)
    })
  }, [filter, categoryFilter])

  const grouped = useMemo(() => groupByCategory(filteredIcons), [filteredIcons])

  const selectedStandard = isReact95IconId(value)
    ? value
    : !isCustomIconValue(value)
      ? (defaultIcon ?? value)
      : (defaultIcon ?? '')

  useEffect(() => {
    return () => {
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current)
      if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current)
    }
  }, [])

  function revokePreviews() {
    if (originalUrlRef.current) {
      URL.revokeObjectURL(originalUrlRef.current)
      originalUrlRef.current = null
    }
    if (processedUrlRef.current) {
      URL.revokeObjectURL(processedUrlRef.current)
      processedUrlRef.current = null
    }
    setOriginalPreview(null)
    setOriginalEmoji(null)
    setProcessedPreview(null)
  }

  async function prepareFilePreview(file: File, usePixelate: boolean) {
    setUploadError(null)
    revokePreviews()
    setPendingSource({ kind: 'file', file })
    setEmojiInput('')

    const originalUrl = blobPreviewUrl(file)
    originalUrlRef.current = originalUrl
    setOriginalPreview(originalUrl)

    try {
      const blob = await processIconUpload(file, { pixelate: usePixelate })
      const processedUrl = blobPreviewUrl(blob)
      processedUrlRef.current = processedUrl
      setProcessedPreview(processedUrl)
    } catch (err) {
      setPendingSource(null)
      revokePreviews()
      setUploadError(
        err instanceof IconUploadError
          ? err.message
          : 'Kunne ikke behandle bildet.',
      )
    }
  }

  async function prepareEmojiPreview(rawEmoji: string, usePixelate: boolean) {
    setUploadError(null)
    revokePreviews()

    let emoji: string
    try {
      emoji = normalizeEmojiInput(rawEmoji)
    } catch (err) {
      setPendingSource(null)
      setUploadError(
        err instanceof IconUploadError
          ? err.message
          : 'Ugyldig emoji.',
      )
      return
    }

    setPendingSource({ kind: 'emoji', emoji })
    setEmojiInput(emoji)
    setOriginalEmoji(emoji)

    try {
      const blob = await processEmojiIcon(emoji, { pixelate: usePixelate })
      const processedUrl = blobPreviewUrl(blob)
      processedUrlRef.current = processedUrl
      setProcessedPreview(processedUrl)
    } catch (err) {
      setPendingSource(null)
      revokePreviews()
      setUploadError(
        err instanceof IconUploadError
          ? err.message
          : 'Kunne ikke behandle emoji.',
      )
    }
  }

  async function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    await prepareFilePreview(file, pixelate)
  }

  async function handlePixelateToggle(next: boolean) {
    setPixelate(next)
    if (!pendingSource) return
    if (pendingSource.kind === 'file') {
      await prepareFilePreview(pendingSource.file, next)
    } else {
      await prepareEmojiPreview(pendingSource.emoji, next)
    }
  }

  async function handleUpload() {
    if (!pendingSource || !processedPreview || uploading) return
    setUploading(true)
    setUploadError(null)
    try {
      const customValue =
        pendingSource.kind === 'file'
          ? await uploadCustomIcon(pendingSource.file, { pixelate })
          : await uploadEmojiIcon(pendingSource.emoji, { pixelate })
      onChange(customValue)
      revokePreviews()
      setPendingSource(null)
      setEmojiInput('')
      void queryClient.invalidateQueries({ queryKey: CUSTOM_ICONS_QUERY_KEY })
    } catch (err) {
      setUploadError(
        err instanceof IconUploadError
          ? err.message
          : 'Opplasting feilet. Prøv igjen.',
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="win95-field">
      <span id={labelId}>{label}</span>

      <div
        className="win95-icon-picker-tabs"
        role="tablist"
        aria-label="Ikontype"
      >
        <button
          type="button"
          role="tab"
          className="win95-icon-picker-tabs__tab"
          aria-selected={mode === 'standard'}
          onClick={() => setMode('standard')}
        >
          Standard
        </button>
        <button
          type="button"
          role="tab"
          className="win95-icon-picker-tabs__tab"
          aria-selected={mode === 'custom'}
          onClick={() => setMode('custom')}
        >
          Egendefinert
        </button>
      </div>

      {mode === 'standard' ? (
        <div role="tabpanel" className="win95-icon-picker-panel">
          <div className="win95-icon-picker-toolbar">
            <Input
              id={`${labelId}-filter`}
              value={filter}
              onChange={(e) => setFilter(e.currentTarget.value)}
              placeholder="Søk ikon…"
              aria-label="Søk ikon"
              style={{ flex: 1, minWidth: 0 }}
            />
            <Win95Select
              id={`${labelId}-category`}
              value={categoryFilter}
              options={categoryOptions}
              onChange={(next) => setCategoryFilter(next as CategoryFilter)}
              aria-label="Kategori"
              style={{ width: 180, flexShrink: 0 }}
            />
          </div>

          <div
            className="win95-icon-picker"
            role="group"
            aria-labelledby={labelId}
          >
            {grouped.map(({ category, icons }) => (
              <div key={category} className="win95-icon-picker__section">
                <div className="win95-icon-picker__section-title">
                  {REACT95_ICON_CATEGORY_LABELS[category]}
                  <span className="win95-muted"> · {icons.length}</span>
                </div>
                <div className="win95-icon-picker__grid">
                  {icons.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="win95-icon-picker__option"
                      aria-label={option.id}
                      aria-pressed={selectedStandard === option.id}
                      title={option.id}
                      onClick={() => onChange(option.id)}
                    >
                      <React95Icon icon={option.id} size={32} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filteredIcons.length === 0 ? (
              <p className="win95-muted" style={{ margin: 4, fontSize: 12 }}>
                Ingen ikoner matcher
                {filter.trim() ? ` «${filter.trim()}»` : ''}.
              </p>
            ) : null}
          </div>

          <p className="win95-muted" style={{ margin: '4px 0 0', fontSize: 11 }}>
            Valgt:{' '}
            {isCustomIconValue(value)
              ? selectedStandard || '—'
              : (selectedStandard || value)}
            {filter.trim() || categoryFilter !== 'all'
              ? ` · ${filteredIcons.length} treff`
              : ` · ${REACT95_ICONS.length} ikoner`}
          </p>
        </div>
      ) : (
        <div role="tabpanel" className="win95-icon-picker-panel">
          <div className="win95-icon-picker-custom__library">
            <div className="win95-icon-picker__section-title">
              Lagrede ikoner
              {!savedPending ? (
                <span className="win95-muted"> · {savedIcons.length}</span>
              ) : null}
            </div>

            {savedPending ? (
              <p className="win95-muted" style={{ margin: 4, fontSize: 12 }}>
                Laster lagrede ikoner…
              </p>
            ) : savedError ? (
              <p className="win95-icon-picker-custom__error" role="alert">
                Kunne ikke hente lagrede ikoner.
              </p>
            ) : savedIcons.length === 0 ? (
              <p className="win95-muted" style={{ margin: 4, fontSize: 12 }}>
                Ingen lagrede ikoner ennå. Lim inn en emoji eller last opp et bilde under.
              </p>
            ) : (
              <div className="win95-icon-picker win95-icon-picker--library">
                <div className="win95-icon-picker__grid">
                  {savedIcons.map((row) => {
                    const iconValue = toCustomIconValue(row.storage_path)
                    const selected = value === iconValue
                    return (
                      <div
                        key={row.id}
                        className="win95-icon-picker-custom__saved"
                      >
                        <button
                          type="button"
                          className="win95-icon-picker__option"
                          aria-label={row.name || 'Egendefinert ikon'}
                          aria-pressed={selected}
                          title={row.name || row.storage_path}
                          onClick={() => onChange(iconValue)}
                        >
                          <React95Icon icon={iconValue} size={32} />
                        </button>
                        <button
                          type="button"
                          className="win95-icon-picker-custom__delete"
                          aria-label={`Slett ${row.name || 'ikon'}`}
                          title="Slett fra bibliotek"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Slette ikonet «${row.name || 'uten navn'}» fra biblioteket?`,
                              )
                            ) {
                              deleteMutation.mutate(row)
                            }
                          }}
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {deleteMutation.isError ? (
              <p className="win95-icon-picker-custom__error" role="alert">
                {deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : 'Kunne ikke slette ikonet.'}
              </p>
            ) : null}
          </div>

          <div className="win95-icon-picker__section-title">Last opp nytt</div>

          {isCustomIconValue(value) ? (
            <div className="win95-icon-picker-custom__current">
              <React95Icon icon={value} size={32} />
              <span className="win95-muted" style={{ fontSize: 11 }}>
                Nåværende egendefinert ikon
              </span>
            </div>
          ) : null}

          <div className="win95-icon-picker-custom__emoji">
            <label
              className="win95-icon-picker-custom__emoji-label"
              htmlFor={`${labelId}-emoji`}
            >
              Eller lim inn emoji
            </label>
            <div className="win95-icon-picker-custom__emoji-row">
              <Input
                id={`${labelId}-emoji`}
                value={emojiInput}
                onChange={(e) => setEmojiInput(e.currentTarget.value)}
                placeholder="☕"
                aria-label="Emoji"
                style={{ width: 72, textAlign: 'center', fontSize: 22 }}
              />
              <Button
                onClick={() => {
                  void prepareEmojiPreview(emojiInput, pixelate)
                }}
              >
                Forhåndsvis
              </Button>
            </div>
            <div
              className="win95-icon-picker-custom__emoji-picks"
              role="group"
              aria-label="Hurtigvalg emoji"
            >
              {EMOJI_QUICK_PICKS.map((pick) => (
                <button
                  key={pick}
                  type="button"
                  className="win95-icon-picker-custom__emoji-pick"
                  aria-label={`Bruk ${pick}`}
                  title={pick}
                  onClick={() => {
                    void prepareEmojiPreview(pick, pixelate)
                  }}
                >
                  {pick}
                </button>
              ))}
            </div>
          </div>

          <label className="win95-icon-picker-custom__file" htmlFor={fileInputId}>
            <span>Velg bilde</span>
            <input
              id={fileInputId}
              type="file"
              accept={ICON_UPLOAD_ACCEPT}
              onChange={(e) => {
                void handleFileChange(e.currentTarget.files)
                e.currentTarget.value = ''
              }}
            />
          </label>

          <p className="win95-muted" style={{ margin: '4px 0', fontSize: 11 }}>
            Emoji pikseleres til Win95 · eller PNG/JPEG/WebP/GIF · maks 2 MB
          </p>

          <Checkbox
            checked={pixelate}
            onChange={() => {
              void handlePixelateToggle(!pixelate)
            }}
          >
            Pikselér til Win95-stil
          </Checkbox>

          {(originalPreview || originalEmoji || processedPreview) && (
            <div className="win95-icon-picker-custom__previews">
              {originalEmoji ? (
                <div className="win95-icon-picker-custom__preview">
                  <span
                    className="win95-icon-picker-custom__emoji-original"
                    aria-hidden
                  >
                    {originalEmoji}
                  </span>
                  <span>Original</span>
                </div>
              ) : originalPreview ? (
                <div className="win95-icon-picker-custom__preview">
                  <img src={originalPreview} alt="" />
                  <span>Original</span>
                </div>
              ) : null}
              {processedPreview ? (
                <div className="win95-icon-picker-custom__preview">
                  <img
                    src={processedPreview}
                    alt=""
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span>{pixelate ? 'Pikselert 64×64' : '64×64'}</span>
                </div>
              ) : null}
            </div>
          )}

          {uploadError ? (
            <p className="win95-icon-picker-custom__error" role="alert">
              {uploadError}
            </p>
          ) : null}

          <div className="win95-icon-picker-custom__actions">
            <Button
              disabled={!pendingSource || !processedPreview || uploading}
              onClick={() => void handleUpload()}
            >
              {uploading ? 'Laster opp…' : 'Last opp og lagre'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
