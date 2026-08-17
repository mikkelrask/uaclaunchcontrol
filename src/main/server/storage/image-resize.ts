// Screenshot downscaling on the way into the images directory.
//
// Protocols can be exported as a single JSON with the screenshot embedded as
// base64, so anything stored here must stay small enough to keep that export
// under a 2MB ceiling. Screenshots are only ever displayed small in the UI,
// so 800px on the longest edge (proportions kept) is plenty of detail.
//
// Formats jimp can decode (png/jpeg/bmp/tiff) are resized; GIFs are left
// alone because they may be animated (resizing flattens them to one frame)
// and WebP has no decoder in this runtime.
import { Jimp, ResizeStrategy } from 'jimp'

type JimpImage = Awaited<ReturnType<typeof Jimp.read>>

export const MAX_LONGEST_EDGE = 800
// Raw bytes above this are re-encoded as JPEG: 1.4MB ≈ 1.87MB base64, under
// the 2MB export ceiling with headroom for the rest of the JSON payload.
export const MAX_SAFE_BYTES = 1_400_000

const JPEG_RESIZE_QUALITY = 90
const JPEG_FALLBACK_QUALITY = 80

const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff'
}

export interface ResizedImage {
  buffer: Buffer
  /** Effective extension (with dot) of the returned buffer — becomes `.jpg` when the budget fallback kicks in. */
  ext: string
}

/** Re-encode an image as JPEG, flattening any alpha onto white first. */
async function jpegBudgetFallback(image: JimpImage): Promise<Buffer> {
  const flat = new Jimp({ width: image.width, height: image.height, color: 0xffffffff })
  flat.composite(image, 0, 0)
  return flat.getBuffer('image/jpeg', { quality: JPEG_FALLBACK_QUALITY })
}

/**
 * Downscale `buffer` so its longest edge is at most `MAX_LONGEST_EDGE`, keeping
 * proportions. Images already within both the size and byte budgets pass
 * through byte-identical (no re-encode, so no quality loss); anything that
 * still exceeds `MAX_SAFE_BYTES` after resizing is re-encoded as JPEG so the
 * base64 export stays under 2MB.
 */
export async function resizeImageIfNeeded(buffer: Buffer, ext: string): Promise<ResizedImage> {
  const lowerExt = ext.toLowerCase()
  const mime = EXT_TO_MIME[lowerExt]
  if (!mime) return { buffer, ext: lowerExt }

  let image: JimpImage
  try {
    image = await Jimp.read(buffer)
  } catch {
    // Unsupported/corrupt input — keep the bytes as-is rather than failing the upload.
    return { buffer, ext: lowerExt }
  }

  if (Math.max(image.width, image.height) <= MAX_LONGEST_EDGE) {
    if (buffer.length <= MAX_SAFE_BYTES) return { buffer, ext: lowerExt }
    // Over budget even at a sane size (e.g. pure noise) — JPEG fallback.
    try {
      return { buffer: await jpegBudgetFallback(image), ext: '.jpg' }
    } catch {
      return { buffer, ext: lowerExt }
    }
  }

  const scale = MAX_LONGEST_EDGE / Math.max(image.width, image.height)
  image.resize({
    w: Math.round(image.width * scale),
    h: Math.round(image.height * scale),
    mode: ResizeStrategy.BICUBIC
  })

  let out: Buffer
  try {
    const getBuffer = image.getBuffer.bind(image) as (
      mime: string,
      options?: { quality?: number }
    ) => Promise<Buffer>
    out = await getBuffer(
      mime,
      mime === 'image/jpeg' ? { quality: JPEG_RESIZE_QUALITY } : undefined
    )
  } catch {
    return { buffer, ext: lowerExt }
  }

  if (out.length <= MAX_SAFE_BYTES) return { buffer: out, ext: lowerExt }
  try {
    return { buffer: await jpegBudgetFallback(image), ext: '.jpg' }
  } catch {
    return { buffer: out, ext: lowerExt }
  }
}
