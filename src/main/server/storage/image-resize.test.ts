import { describe, it, expect } from 'vitest'
import { Jimp } from 'jimp'
import { MAX_LONGEST_EDGE, MAX_SAFE_BYTES, resizeImageIfNeeded } from './image-resize'

/** Deterministic PRNG so budget-fallback tests don't flake run to run. */
function seededNoise(length: number, seed = 12345): Buffer {
  const data = Buffer.alloc(length)
  let s = seed
  for (let i = 0; i < length; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    data[i] = Math.floor((s / 2147483648) * 256)
  }
  return data
}

async function buildPng(width: number, height: number, noise = false): Promise<Buffer> {
  const img = new Jimp({ width, height, color: 0xffffffff })
  if (noise) {
    seededNoise(img.bitmap.data.length).copy(img.bitmap.data)
  }
  return img.getBuffer('image/png')
}

async function buildJpeg(width: number, height: number): Promise<Buffer> {
  const img = new Jimp({ width, height, color: 0xffffffff })
  return img.getBuffer('image/jpeg', { quality: 90 })
}

async function dimsOf(buffer: Buffer): Promise<{ width: number; height: number }> {
  const img = await Jimp.read(buffer)
  return { width: img.width, height: img.height }
}

describe('resizeImageIfNeeded', () => {
  it('downscales a large landscape image keeping proportions', async () => {
    const { buffer, ext } = await resizeImageIfNeeded(await buildPng(2000, 1500), '.png')
    expect(ext).toBe('.png')
    const dims = await dimsOf(buffer)
    expect(dims).toEqual({ width: 800, height: 600 })
  })

  it('downscales a large portrait image keeping proportions', async () => {
    const { buffer, ext } = await resizeImageIfNeeded(await buildPng(1000, 2000), '.png')
    expect(ext).toBe('.png')
    const dims = await dimsOf(buffer)
    expect(dims).toEqual({ width: 400, height: 800 })
  })

  it('never upscales images smaller than the cap', async () => {
    const original = await buildPng(500, 400)
    const result = await resizeImageIfNeeded(original, '.png')
    expect(result.buffer).toBe(original)
    expect(result.ext).toBe('.png')
  })

  it('re-encodes resized JPEGs as JPEG', async () => {
    const { buffer, ext } = await resizeImageIfNeeded(await buildJpeg(2000, 1500), '.jpg')
    expect(ext).toBe('.jpg')
    const dims = await dimsOf(buffer)
    expect(dims).toEqual({ width: 800, height: 600 })
  })

  it('re-encodes as JPEG when an already-small image exceeds the byte budget', async () => {
    // 800x800 pure noise stays ~2.5MB as PNG — over budget at any size.
    const original = await buildPng(800, 800, true)
    expect(original.length).toBeGreaterThan(MAX_SAFE_BYTES)
    const { buffer, ext } = await resizeImageIfNeeded(original, '.png')
    expect(ext).toBe('.jpg')
    expect(buffer.length).toBeLessThan(MAX_SAFE_BYTES)
    const dims = await dimsOf(buffer)
    expect(Math.max(dims.width, dims.height)).toBe(800)
  })

  it('resizes then falls back to JPEG when still over the byte budget', async () => {
    const original = await buildPng(1600, 1600, true)
    const { buffer, ext } = await resizeImageIfNeeded(original, '.png')
    expect(ext).toBe('.jpg')
    expect(buffer.length).toBeLessThan(MAX_SAFE_BYTES)
    const dims = await dimsOf(buffer)
    expect(Math.max(dims.width, dims.height)).toBe(MAX_LONGEST_EDGE)
  })

  it('passes GIFs through untouched (may be animated)', async () => {
    const gif = Buffer.from('GIF89a-fake-content')
    const result = await resizeImageIfNeeded(gif, '.gif')
    expect(result.buffer).toBe(gif)
    expect(result.ext).toBe('.gif')
  })

  it('passes unsupported extensions through untouched', async () => {
    const heic = Buffer.from('not-decodable-here')
    const result = await resizeImageIfNeeded(heic, '.heic')
    expect(result.buffer).toBe(heic)
    expect(result.ext).toBe('.heic')
  })

  it('passes corrupt images through untouched instead of failing the upload', async () => {
    const corrupt = Buffer.from('this is not a png at all')
    const result = await resizeImageIfNeeded(corrupt, '.png')
    expect(result.buffer).toBe(corrupt)
    expect(result.ext).toBe('.png')
  })
})
