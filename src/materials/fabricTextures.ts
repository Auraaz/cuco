import * as THREE from 'three'
import type { MaterialPresetId } from '../types'

/**
 * Procedural fabric texture maps. Each material preset gets a tiling
 * normal map (and repeat/scale/env params) generated on a canvas, so
 * cotton, denim, leather etc. read as real materials rather than just
 * different roughness numbers — with no external texture assets.
 */

/* 128 is plenty for a tiling micro-normal map (repeated 4–9×) and bakes
   ~4× faster than 256, keeping any first-use build well under a frame. */
const SIZE = 128

export interface FabricMaps {
  normalMap: THREE.Texture | null
  normalScale: number
  repeat: number
  envMapIntensity: number
}

/** Height field in [0,1] for a family, sampled at tiled uv (0..1). */
type HeightFn = (u: number, v: number) => number

const TAU = Math.PI * 2

// Cheap value-noise so leather/fleece don't look mechanical.
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function noise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const tl = hash(xi, yi)
  const tr = hash(xi + 1, yi)
  const bl = hash(xi, yi + 1)
  const br = hash(xi + 1, yi + 1)
  const sx = xf * xf * (3 - 2 * xf)
  const sy = yf * yf * (3 - 2 * yf)
  const top = tl + (tr - tl) * sx
  const bot = bl + (br - bl) * sx
  return top + (bot - top) * sy
}
function fbm(x: number, y: number): number {
  let sum = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < 4; i++) {
    sum += amp * noise(x * f, y * f)
    f *= 2
    amp *= 0.5
  }
  return sum
}

const HEIGHTS: Record<MaterialPresetId, HeightFn> = {
  // Plain weave: interlaced over/under bumps.
  cotton: (u, v) => {
    const n = 14
    const warp = Math.sin(u * TAU * n) * 0.5 + 0.5
    const weft = Math.sin(v * TAU * n) * 0.5 + 0.5
    return 0.5 + 0.5 * (warp - weft) * 0.6
  },
  // Diagonal twill lines.
  denim: (u, v) => {
    const n = 16
    const twill = Math.sin((u + v) * TAU * n)
    const grain = fbm(u * 40, v * 40) * 0.15
    return 0.5 + 0.4 * twill + grain
  },
  // Soft lofted pile.
  fleece: (u, v) => 0.4 + 0.6 * fbm(u * 18, v * 18),
  // Cellular pebbled grain.
  leather: (u, v) => {
    const cells = 9
    let d = 1
    const gx = u * cells
    const gy = v * cells
    const cx = Math.floor(gx)
    const cy = Math.floor(gy)
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const fx = cx + ox + hash(cx + ox, cy + oy)
        const fy = cy + oy + hash(cy + oy, cx + ox)
        const dist = Math.hypot(gx - fx, gy - fy)
        if (dist < d) d = dist
      }
    }
    return 0.35 + 0.65 * d + fbm(u * 60, v * 60) * 0.08
  },
  // Open mesh: recessed holes on a grid.
  mesh: (u, v) => {
    const n = 12
    const hx = Math.abs(Math.sin(u * TAU * n))
    const hy = Math.abs(Math.sin(v * TAU * n))
    return Math.min(hx, hy) < 0.35 ? 0.15 : 0.9
  },
  // Near-smooth with faint orange-peel.
  plastic: (u, v) => 0.5 + fbm(u * 26, v * 26) * 0.12,
}

const PARAMS: Record<
  MaterialPresetId,
  { normalScale: number; repeat: number; envMapIntensity: number }
> = {
  cotton: { normalScale: 0.35, repeat: 6, envMapIntensity: 0.9 },
  denim: { normalScale: 0.55, repeat: 7, envMapIntensity: 0.8 },
  fleece: { normalScale: 0.7, repeat: 5, envMapIntensity: 0.6 },
  leather: { normalScale: 0.6, repeat: 4, envMapIntensity: 1.35 },
  plastic: { normalScale: 0.25, repeat: 3, envMapIntensity: 1.6 },
  mesh: { normalScale: 0.8, repeat: 9, envMapIntensity: 0.9 },
}

const cache = new Map<MaterialPresetId, FabricMaps>()

/** Build a normal map from a height field via Sobel-ish differencing. */
function buildNormalMap(h: HeightFn, scale: number): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(SIZE, SIZE)
  const step = 1 / SIZE
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE
      const v = y / SIZE
      const hL = h((u - step + 1) % 1, v)
      const hR = h((u + step) % 1, v)
      const hD = h(u, (v - step + 1) % 1)
      const hU = h(u, (v + step) % 1)
      // Tangent-space normal.
      const nx = (hL - hR) * scale * 4
      const ny = (hD - hU) * scale * 4
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      const i = (y * SIZE + x) * 4
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

export function getFabricMaps(id: MaterialPresetId): FabricMaps {
  const cached = cache.get(id)
  if (cached) return cached
  const params = PARAMS[id]
  const normalMap = buildNormalMap(HEIGHTS[id], params.normalScale)
  if (normalMap) {
    normalMap.repeat.set(params.repeat, params.repeat)
  }
  const maps: FabricMaps = {
    normalMap,
    normalScale: params.normalScale,
    repeat: params.repeat,
    envMapIntensity: params.envMapIntensity,
  }
  cache.set(id, maps)
  return maps
}

/**
 * Pre-bake every preset's normal map during browser idle time, one per
 * callback, so the very first switch to a material is a cache hit rather
 * than a ~0.5s synchronous bake on the interaction thread. Safe to call
 * repeatedly; already-cached presets are skipped.
 */
export function warmFabricCache() {
  if (typeof document === 'undefined') return
  const ids = (Object.keys(PARAMS) as MaterialPresetId[]).filter((id) => !cache.has(id))
  const idle: (cb: () => void) => void =
    typeof (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback === 'function'
      ? (cb) => (globalThis as unknown as { requestIdleCallback: (c: () => void) => void }).requestIdleCallback(cb)
      : (cb) => setTimeout(cb, 32)
  const step = () => {
    const id = ids.shift()
    if (!id) return
    getFabricMaps(id) /* builds + caches this one preset */
    idle(step) /* spread the rest across later idle slots */
  }
  idle(step)
}
