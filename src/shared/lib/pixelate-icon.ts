/** Upload / pixelate constraints for custom icons. */
export const ICON_UPLOAD_MAX_BYTES = 2 * 1024 * 1024 // 2 MB
export const ICON_UPLOAD_MAX_DIMENSION = 2048
export const ICON_OUTPUT_SIZE = 48
/** Internal render size before nearest-neighbor downscale (emoji path). */
export const EMOJI_RENDER_SIZE = 192
/** Max grapheme clusters allowed as an emoji icon source. */
export const EMOJI_MAX_GRAPHEMES = 4

export const ICON_UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'
export const ICON_UPLOAD_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

/** Classic 16-color VGA-ish palette for Win95-style quantization. */
const WIN95_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [128, 0, 0],
  [0, 128, 0],
  [128, 128, 0],
  [0, 0, 128],
  [128, 0, 128],
  [0, 128, 128],
  [192, 192, 192],
  [128, 128, 128],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [0, 0, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
]

const EMOJI_FONT_STACK =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif'

export type PixelateIconOptions = {
  /** Nearest-neighbor downscale + 16-color quantization. Default true. */
  pixelate?: boolean
}

export class IconUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IconUploadError'
  }
}

/**
 * Normalize pasted/typed emoji input to a short grapheme sequence.
 * ZWJ sequences (e.g. 👨‍👩‍👧) count as one grapheme.
 */
export function normalizeEmojiInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new IconUploadError('Skriv inn eller lim inn en emoji.')
  }

  const graphemes =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
          trimmed,
        )].map((s) => s.segment)
      : Array.from(trimmed)

  if (graphemes.length === 0) {
    throw new IconUploadError('Skriv inn eller lim inn en emoji.')
  }

  if (graphemes.length > EMOJI_MAX_GRAPHEMES) {
    throw new IconUploadError(
      `For mange tegn. Bruk maks ${EMOJI_MAX_GRAPHEMES} emoji.`,
    )
  }

  // Reject plain ASCII / whitespace-only "emoji" (e.g. "ab", "A").
  const joined = graphemes.join('')
  if (/^[\x00-\x7F]+$/.test(joined)) {
    throw new IconUploadError('Det ser ikke ut som en emoji. Prøv ☕ eller 🥐.')
  }

  return joined
}

function nearestPaletteColor(
  r: number,
  g: number,
  b: number,
): readonly [number, number, number] {
  let best = WIN95_PALETTE[0]
  let bestDist = Infinity
  for (const color of WIN95_PALETTE) {
    const dr = r - color[0]
    const dg = g - color[1]
    const db = b - color[2]
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      best = color
    }
  }
  return best
}

function quantizeImageData(data: ImageData): void {
  const pixels = data.data
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3]
    if (a < 128) {
      pixels[i] = 0
      pixels[i + 1] = 0
      pixels[i + 2] = 0
      pixels[i + 3] = 0
      continue
    }
    const [nr, ng, nb] = nearestPaletteColor(
      pixels[i],
      pixels[i + 1],
      pixels[i + 2],
    )
    pixels[i] = nr
    pixels[i + 1] = ng
    pixels[i + 2] = nb
    pixels[i + 3] = 255
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new IconUploadError('Kunne ikke lese bildet. Prøv en annen fil.'))
    }
    img.src = url
  })
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new IconUploadError('Kunne ikke lage PNG av bildet.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

function createOutputCanvas(): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = ICON_OUTPUT_SIZE
  canvas.height = ICON_OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new IconUploadError('Kunne ikke behandle bildet i nettleseren.')
  }
  ctx.clearRect(0, 0, ICON_OUTPUT_SIZE, ICON_OUTPUT_SIZE)
  return { canvas, ctx }
}

function finishPixelatedCanvas(ctx: CanvasRenderingContext2D): void {
  const imageData = ctx.getImageData(0, 0, ICON_OUTPUT_SIZE, ICON_OUTPUT_SIZE)
  quantizeImageData(imageData)
  ctx.putImageData(imageData, 0, 0)
}

/**
 * Draw emoji onto an offscreen canvas using the system color-emoji font.
 * Renders large so nearest-neighbor downscale looks chunky/Win95.
 */
function renderEmojiSourceCanvas(emoji: string): HTMLCanvasElement {
  const size = EMOJI_RENDER_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new IconUploadError('Kunne ikke behandle emoji i nettleseren.')
  }

  ctx.clearRect(0, 0, size, size)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Slightly under full size so glyphs aren't clipped on some fonts.
  ctx.font = `${Math.floor(size * 0.78)}px ${EMOJI_FONT_STACK}`
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.03)

  return canvas
}

/**
 * Validate and convert an uploaded image to a 48×48 PNG icon.
 * With pixelate: nearest-neighbor + 16-color palette.
 * Without: smooth center-crop scale.
 */
export async function processIconUpload(
  file: File,
  options: PixelateIconOptions = {},
): Promise<Blob> {
  const pixelate = options.pixelate !== false

  if (!ICON_UPLOAD_MIME_TYPES.has(file.type)) {
    throw new IconUploadError(
      'Ugyldig filtype. Bruk PNG, JPEG, WebP eller GIF.',
    )
  }

  if (file.size > ICON_UPLOAD_MAX_BYTES) {
    throw new IconUploadError('Filen er for stor. Maks størrelse er 2 MB.')
  }

  const img = await loadImage(file)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height

  if (srcW < 1 || srcH < 1) {
    throw new IconUploadError('Bildet har ugyldige dimensjoner.')
  }

  if (srcW > ICON_UPLOAD_MAX_DIMENSION || srcH > ICON_UPLOAD_MAX_DIMENSION) {
    throw new IconUploadError(
      `Bildet er for stort. Maks ${ICON_UPLOAD_MAX_DIMENSION}×${ICON_UPLOAD_MAX_DIMENSION} piksler.`,
    )
  }

  const { canvas: out, ctx } = createOutputCanvas()
  const size = ICON_OUTPUT_SIZE

  if (pixelate) {
    const scale = Math.min(size / srcW, size / srcH)
    const dw = Math.max(1, Math.round(srcW * scale))
    const dh = Math.max(1, Math.round(srcH * scale))
    const dx = Math.floor((size - dw) / 2)
    const dy = Math.floor((size - dh) / 2)

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, dx, dy, dw, dh)
    finishPixelatedCanvas(ctx)
  } else {
    const side = Math.min(srcW, srcH)
    const sx = Math.floor((srcW - side) / 2)
    const sy = Math.floor((srcH - side) / 2)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
  }

  return canvasToPngBlob(out)
}

/**
 * Rasterize an emoji to a 48×48 PNG icon.
 * With pixelate: large render → nearest-neighbor downscale → 16-color palette.
 * Without: draw at output size with font smoothing.
 */
export async function processEmojiIcon(
  rawEmoji: string,
  options: PixelateIconOptions = {},
): Promise<Blob> {
  const emoji = normalizeEmojiInput(rawEmoji)
  const pixelate = options.pixelate !== false
  const { canvas: out, ctx } = createOutputCanvas()
  const size = ICON_OUTPUT_SIZE

  if (pixelate) {
    const source = renderEmojiSourceCanvas(emoji)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(source, 0, 0, size, size)
    finishPixelatedCanvas(ctx)
  } else {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${Math.floor(size * 0.78)}px ${EMOJI_FONT_STACK}`
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.03)
  }

  return canvasToPngBlob(out)
}

/** Create an object URL for a Blob (caller should revoke). */
export function blobPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
