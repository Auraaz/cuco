import { renderText } from './textRender'
import type {
  DecalLayer,
  DesignConfig,
  DesignVariable,
  PartGroup,
  PartState,
  VariableTarget,
  Zone,
} from '../types'

/** One spreadsheet row: a display name plus column→value pairs. */
export interface VariantRow {
  name: string
  values: Record<string, string>
}

/** Resolves a graphic cell value (filepath / name / URL) to a data URL, or null. */
export type GraphicResolver = (value: string) => Promise<string | null>

interface DesignSnapshot {
  parts: PartState[]
  layers: DecalLayer[]
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** True when two variable targets point at the same element. */
export function sameTarget(a: VariableTarget, b: VariableTarget): boolean {
  if (a.kind !== b.kind) return false
  if ('partId' in a && 'partId' in b) return a.partId === b.partId
  if ('groupId' in a && 'groupId' in b) return a.groupId === b.groupId
  if ('layerId' in a && 'layerId' in b) return a.layerId === b.layerId
  return false
}

/** A filesystem/URL-safe slug for zip folder names. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'variant'
  )
}

/**
 * Normalise any CSS-ish color (hex, 3-digit hex, name, rgb()) to #RRGGBB,
 * or null if it isn't a valid color. Uses the canvas parser with two
 * sentinels so invalid input is detected rather than silently kept.
 */
export function normalizeColor(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const six = s.match(/^#?([0-9a-fA-F]{6})$/)
  if (six) return `#${six[1].toUpperCase()}`
  const three = s.match(/^#?([0-9a-fA-F]{3})$/)
  if (three) {
    const [r, g, b] = three[1].split('')
    return `#${(r + r + g + g + b + b).toUpperCase()}`
  }
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#000000'
    ctx.fillStyle = s
    const a = ctx.fillStyle
    ctx.fillStyle = '#ffffff'
    ctx.fillStyle = s
    const b = ctx.fillStyle
    if (a !== b) return null /* kept the sentinel → invalid color */
    if (typeof a === 'string' && a.startsWith('#')) return a.toUpperCase()
    const m = String(a).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (m) {
      const to = (n: string) => Number(n).toString(16).padStart(2, '0')
      return `#${(to(m[1]) + to(m[2]) + to(m[3])).toUpperCase()}`
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Measure an image's aspect ratio (w/h) from a data URL. */
export function measureAspect(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () =>
      resolve(img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1)
    img.onerror = () => resolve(1)
    img.src = dataUrl
  })
}

const raf = () =>
  new Promise<void>((r) => requestAnimationFrame(() => r()))

/**
 * Wait long enough after a state change for React to commit, materials to
 * apply, and decal textures to upload before capturing a frame.
 */
export async function settleFrames(): Promise<void> {
  await raf()
  await raf()
  await new Promise((r) => setTimeout(r, 110))
  await raf()
}

/** Build a DesignConfig (v3) for a specific parts/layers snapshot. */
export function designConfigFor(
  productId: string,
  parts: PartState[],
  layers: DecalLayer[],
  variables: DesignVariable[],
): DesignConfig {
  return {
    app: 'apparel-studio',
    version: 3,
    productId,
    parts: parts.map((p) => ({ ...p })),
    layers: layers.map((l) => ({ ...l })),
    colorways: [],
    variables,
  }
}

/** Serialise a matrix of strings to CSV (RFC-4180 quoting). */
export function toCsv(rows: string[][]): string {
  const esc = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  return rows.map((r) => r.map(esc).join(',')).join('\r\n')
}

/* ------------------------------------------------------------------ */
/* Apply one row to the base design                                    */
/* ------------------------------------------------------------------ */

/** Case-insensitive lookup of a column value. */
function lookup(values: Record<string, string>, key: string): string | undefined {
  if (key in values) return values[key]
  const lk = key.toLowerCase()
  for (const k of Object.keys(values)) {
    if (k.toLowerCase() === lk) return values[k]
  }
  return undefined
}

/** Match a placement value to a zone by id or label (case-insensitive). */
function zoneForValue(zones: Zone[], value: string): Zone | undefined {
  const v = value.trim().toLowerCase()
  return zones.find(
    (z) => z.id.toLowerCase() === v || z.label.toLowerCase() === v,
  )
}

/**
 * Produce a fresh parts/layers snapshot with every variable's row value
 * applied on top of the base design. Async because graphics and text
 * layers must be resolved/re-rendered and measured.
 */
export async function applyVariant(
  base: DesignSnapshot,
  variables: DesignVariable[],
  values: Record<string, string>,
  resolver: GraphicResolver,
  zones: Zone[],
  groups: PartGroup[] = [],
): Promise<DesignSnapshot> {
  const parts = base.parts.map((p) => ({ ...p }))
  const layers = base.layers.map((l) => ({
    ...l,
    position: [...l.position] as DecalLayer['position'],
    rotation: [...l.rotation] as DecalLayer['rotation'],
    text: l.text ? { ...l.text } : undefined,
  }))

  for (const v of variables) {
    const raw = lookup(values, v.name)
    if (raw === undefined) continue /* column not present in the row */
    const value = String(raw)

    if (v.target.kind === 'partColor') {
      const part = parts.find((p) => p.id === (v.target as { partId: string }).partId)
      if (!part) continue
      const hex = normalizeColor(value)
      if (hex) part.color = hex
      continue
    }

    if (v.target.kind === 'groupColor') {
      const group = groups.find((g) => g.id === (v.target as { groupId: string }).groupId)
      if (!group) continue
      const hex = normalizeColor(value)
      if (hex) {
        for (const part of parts) {
          if (group.partIds.includes(part.id)) part.color = hex
        }
      }
      continue
    }

    const layerId = (v.target as { layerId: string }).layerId
    const layer = layers.find((l) => l.id === layerId)
    if (!layer) continue

    if (v.target.kind === 'layerText') {
      const trimmed = value.trim()
      if (!trimmed) {
        layer.visible = false
        continue
      }
      const spec = layer.text ?? {
        content: trimmed,
        font: 'sans',
        weight: 700,
        color: '#18181B',
      }
      const nextSpec = { ...spec, content: trimmed }
      const { dataUrl, aspect } = renderText(nextSpec)
      layer.text = nextSpec
      layer.image = dataUrl
      layer.aspect = aspect
      layer.visible = true
      layer.name = trimmed.split('\n')[0].slice(0, 24) || 'Text'
    } else if (v.target.kind === 'layerTextColor') {
      const hex = normalizeColor(value)
      if (hex && layer.text) {
        const nextSpec = { ...layer.text, color: hex }
        const { dataUrl, aspect } = renderText(nextSpec)
        layer.text = nextSpec
        layer.image = dataUrl
        layer.aspect = aspect
      }
    } else if (v.target.kind === 'layerTextFont') {
      const font = value.trim().toLowerCase()
      if (font && layer.text) {
        const nextSpec = { ...layer.text, font }
        const { dataUrl, aspect } = renderText(nextSpec)
        layer.text = nextSpec
        layer.image = dataUrl
        layer.aspect = aspect
      }
    } else if (v.target.kind === 'layerImage') {
      if (!value.trim()) {
        layer.visible = false
        continue
      }
      const resolved = await resolver(value)
      if (resolved) {
        layer.image = resolved
        layer.aspect = await measureAspect(resolved)
        layer.text = undefined
        layer.visible = true
      }
      /* If unresolved, leave the base artwork in place. */
    } else if (v.target.kind === 'layerPlacement') {
      const zone = zoneForValue(zones, value)
      if (zone) {
        layer.zoneId = zone.id
        layer.mesh = zone.mesh
        layer.position = [...zone.position]
        layer.rotation = [...zone.rotation]
        layer.scale = zone.scale
      } else {
        const nums = value
          .split(/[,\s]+/)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
        if (nums.length >= 2) {
          layer.zoneId = null
          layer.position = [nums[0], nums[1], nums[2] ?? layer.position[2]]
        }
      }
    }
  }

  return { parts, layers }
}
