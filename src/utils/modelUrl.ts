/**
 * Remote model URL handling: normalize GitHub links to the jsDelivr CDN,
 * validate the URL, and fetch bytes with progress. Keeping this separate
 * (and extension-driven) leaves room for future asset types.
 */

/** A user-facing error with a friendly message. */
export class ModelError extends Error {}

export type ModelFormat = 'gltf' | 'usdz'

export type UrlCheck =
  | { ok: true; url: string; format: ModelFormat }
  | { ok: false; reason: string }

/** Supported model extensions → loader format. */
const EXT_FORMAT: Record<string, ModelFormat> = {
  glb: 'gltf',
  gltf: 'gltf',
  usdz: 'usdz',
  usd: 'usdz',
  usda: 'usdz',
  usdc: 'usdz',
}

/** Loader format for a filename or URL, or null if unsupported. */
export function formatForName(name: string): ModelFormat | null {
  const ext = name.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() ?? ''
  return EXT_FORMAT[ext] ?? null
}

/**
 * Convert a github.com blob/raw link or a raw.githubusercontent.com link to
 * the equivalent jsDelivr CDN URL (preferred: global CDN, cached, CORS-ok).
 * Any other URL is returned unchanged.
 */
export function toJsdelivr(input: string): string {
  const u = input.trim()
  const blob = u.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)$/i,
  )
  if (blob) return `https://cdn.jsdelivr.net/gh/${blob[1]}/${blob[2]}@${blob[3]}/${blob[4]}`
  const raw = u.match(
    /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i,
  )
  if (raw) return `https://cdn.jsdelivr.net/gh/${raw[1]}/${raw[2]}@${raw[3]}/${raw[4]}`
  return u
}

/**
 * Validate a model URL. Accepts https:// (and http://localhost) URLs ending
 * in .glb, plus same-origin absolute paths (/public assets). Rejects
 * ftp://, javascript:, file://, and non-.glb targets.
 */
export function validateModelUrl(input: string): UrlCheck {
  const raw = (input ?? '').trim()
  if (!raw) return { ok: false, reason: 'Enter a model URL.' }
  const url = toJsdelivr(raw)

  /* Same-origin absolute path — a local /public asset. */
  if (url.startsWith('/') && !url.startsWith('//')) {
    const format = formatForName(url)
    if (!format) return { ok: false, reason: 'URL must point to a .glb or .usdz file.' }
    return { ok: true, url, format }
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: "That doesn't look like a valid URL." }
  }
  const isLocalHttp = parsed.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(parsed.hostname)
  if (parsed.protocol !== 'https:' && !isLocalHttp) {
    return { ok: false, reason: 'Use a secure https:// URL.' }
  }
  const format = formatForName(parsed.pathname)
  if (!format) {
    return { ok: false, reason: 'URL must end in .glb or .usdz' }
  }
  return { ok: true, url, format }
}

/** Derive a readable model name from a URL's filename. */
export function nameFromUrl(url: string): string {
  try {
    const path = url.startsWith('/') ? url : new URL(url).pathname
    const file = decodeURIComponent(path.split('/').pop() || 'model')
    return (
      file.replace(/\.(glb|gltf|usdz|usda|usdc|usd)$/i, '').replace(/[_-]+/g, ' ').trim() ||
      'Model'
    )
  } catch {
    return 'Model'
  }
}

/**
 * Fetch a model as an ArrayBuffer, reporting byte progress. `onProgress`
 * receives a 0–1 ratio (or null when the server sends no content-length →
 * indeterminate). Throws ModelError with a friendly message on HTTP errors.
 */
export async function fetchModel(
  url: string,
  onProgress: (ratio: number | null, loaded: number, total: number) => void,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal, mode: 'cors', redirect: 'follow' })
  if (res.status === 404) {
    throw new ModelError('Not found (404) — check the URL and that the file exists.')
  }
  if (res.status === 403) {
    throw new ModelError('Access denied (403) — the file may be private.')
  }
  if (!res.ok && res.status !== 206) {
    throw new ModelError(`Server returned ${res.status}.`)
  }

  const total = Number(res.headers.get('content-length')) || 0
  if (!res.body) {
    const buf = await res.arrayBuffer()
    onProgress(1, buf.byteLength, buf.byteLength)
    return buf
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.length
      onProgress(total ? loaded / total : null, loaded, total)
    }
  }
  const out = new Uint8Array(loaded)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out.buffer
}

/** True when the first bytes are the glTF binary magic ("glTF"). */
export function isGlbMagic(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false
  const b = new Uint8Array(buf, 0, 4)
  return b[0] === 0x67 && b[1] === 0x6c && b[2] === 0x54 && b[3] === 0x46
}

/**
 * Validate that the fetched bytes look like the expected format:
 * glTF → "glTF" magic; USD → a ZIP (.usdz, "PK"), a USDC crate
 * ("PXR-USDC"), or ASCII USDA ("#usda").
 */
export function isValidModel(buf: ArrayBuffer, format: ModelFormat): boolean {
  if (format === 'gltf') return isGlbMagic(buf)
  if (buf.byteLength < 4) return false
  const b = new Uint8Array(buf, 0, 8)
  const isZip = b[0] === 0x50 && b[1] === 0x4b /* "PK" */
  const isCrate =
    b[0] === 0x50 && b[1] === 0x58 && b[2] === 0x52 && b[3] === 0x2d /* "PXR-" */
  const isAscii = b[0] === 0x23 && b[1] === 0x75 && b[2] === 0x73 && b[3] === 0x64 /* "#usd" */
  return isZip || isCrate || isAscii
}
