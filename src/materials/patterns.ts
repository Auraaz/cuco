import type { PartTexture, PatternId } from '../types'

/** Built-in patterns, in display order. */
export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: 'stripes', label: 'Stripes' },
  { id: 'diagonal', label: 'Diagonal' },
  { id: 'check', label: 'Check' },
  { id: 'grid', label: 'Grid' },
  { id: 'dots', label: 'Dots' },
  { id: 'chevron', label: 'Chevron' },
  { id: 'camo', label: 'Camo' },
]

/** Display label for a pattern id. */
export function patternLabel(id: PatternId): string {
  return PATTERNS.find((p) => p.id === id)?.label ?? 'Pattern'
}

/** Human-readable spec of a part texture for the tech pack, e.g.
 *  "Check · 4× · 45°" or "Custom texture · 3×". */
export function describeTexture(t: PartTexture): string {
  const base = t.patternId ? patternLabel(t.patternId) : 'Custom texture'
  const bits = [base, `${Number.isInteger(t.scale) ? t.scale : t.scale.toFixed(1)}×`]
  if (Math.round(t.rotation)) bits.push(`${Math.round(t.rotation)}°`)
  return bits.join(' · ')
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const s = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** A contrasting accent shade of the base color (darker on light, lighter on dark). */
export function deriveAccent(base: string): string {
  const [r, g, b] = hexToRgb(base)
  const lum = luminance(base)
  const f = lum > 0.55 ? 0.62 : 1.55 /* darken light colors, lighten dark ones */
  return rgbToHex(r * f, g * f, b * f)
}

const SIZE = 128

/**
 * Render a tileable two-tone pattern (base color + a derived accent) to a
 * data URL, sized to a 128px tile. The result is used as a base-color map,
 * so the material shows the pattern's own colors (mat.color set to white).
 */
export function renderPattern(id: PatternId, base: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const accent = deriveAccent(base)

  ctx.fillStyle = base
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = accent
  ctx.strokeStyle = accent

  switch (id) {
    case 'stripes': {
      const w = SIZE / 4
      for (let x = 0; x < SIZE; x += w * 2) ctx.fillRect(x, 0, w, SIZE)
      break
    }
    case 'diagonal': {
      ctx.lineWidth = SIZE / 8
      ctx.beginPath()
      for (let i = -SIZE; i < SIZE * 2; i += SIZE / 4) {
        ctx.moveTo(i, 0)
        ctx.lineTo(i + SIZE, SIZE)
      }
      ctx.stroke()
      break
    }
    case 'check': {
      const c = SIZE / 4
      for (let y = 0; y < SIZE; y += c) {
        for (let x = 0; x < SIZE; x += c) {
          if (((x / c) + (y / c)) % 2 === 0) ctx.fillRect(x, y, c, c)
        }
      }
      break
    }
    case 'grid': {
      ctx.lineWidth = SIZE / 16
      const step = SIZE / 4
      ctx.beginPath()
      for (let i = 0; i <= SIZE; i += step) {
        ctx.moveTo(i, 0)
        ctx.lineTo(i, SIZE)
        ctx.moveTo(0, i)
        ctx.lineTo(SIZE, i)
      }
      ctx.stroke()
      break
    }
    case 'dots': {
      const step = SIZE / 4
      const r = SIZE / 12
      for (let y = step / 2; y < SIZE; y += step) {
        for (let x = step / 2; x < SIZE; x += step) {
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }
    case 'chevron': {
      ctx.lineWidth = SIZE / 10
      ctx.beginPath()
      const step = SIZE / 4
      for (let y = -step; y < SIZE + step; y += step) {
        ctx.moveTo(0, y)
        ctx.lineTo(SIZE / 2, y + step / 2)
        ctx.lineTo(SIZE, y)
      }
      ctx.stroke()
      break
    }
    case 'camo': {
      /* Layered organic blobs in base, accent, and a mid shade. */
      const mid = deriveAccent(accent)
      const blobs: [string, number][] = [[accent, 9], [mid, 7]]
      /* Deterministic pseudo-random so the tile is stable per color. */
      let seed = 20
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }
      for (const [col, count] of blobs) {
        ctx.fillStyle = col
        for (let i = 0; i < count; i++) {
          const cx = rnd() * SIZE
          const cy = rnd() * SIZE
          const rad = SIZE * (0.1 + rnd() * 0.12)
          ctx.beginPath()
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
            const rr = rad * (0.7 + rnd() * 0.6)
            const px = cx + Math.cos(a) * rr
            const py = cy + Math.sin(a) * rr
            if (a === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.fill()
        }
      }
      break
    }
  }

  return canvas.toDataURL('image/png')
}
