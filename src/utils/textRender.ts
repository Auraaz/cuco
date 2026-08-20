import type { TextSpec } from '../types'

/** Font choices offered by the text tool (all system/web-safe). */
export const TEXT_FONTS: { id: string; label: string; stack: string }[] = [
  { id: 'sans', label: 'Sans', stack: "'Helvetica Neue', Arial, sans-serif" },
  { id: 'serif', label: 'Serif', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'slab', label: 'Slab', stack: "'Rockwell', 'Courier New', serif" },
  { id: 'mono', label: 'Mono', stack: "'SF Mono', ui-monospace, monospace" },
  { id: 'condensed', label: 'Impact', stack: "'Impact', 'Arial Narrow', sans-serif" },
  { id: 'cursive', label: 'Script', stack: "'Snell Roundhand', 'Brush Script MT', cursive" },
]

export function fontStack(id: string): string {
  return TEXT_FONTS.find((f) => f.id === id)?.stack ?? TEXT_FONTS[0].stack
}

export interface RenderedText {
  dataUrl: string
  aspect: number
}

/**
 * Render a text spec to a transparent PNG data URL sized to the glyphs,
 * so it can be projected as a decal like any uploaded artwork.
 */
export function renderText(spec: TextSpec): RenderedText {
  const lines = spec.content.split('\n')
  const fontPx = 128
  const pad = 40
  const lineGap = 1.2
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `${spec.weight} ${fontPx}px ${fontStack(spec.font)}`

  ctx.font = font
  let maxW = 1
  for (const line of lines) {
    maxW = Math.max(maxW, ctx.measureText(line || ' ').width)
  }
  const lineH = fontPx * lineGap
  const w = Math.ceil(maxW) + pad * 2
  const h = Math.ceil(lineH * lines.length) + pad * 2

  canvas.width = w
  canvas.height = h
  ctx.clearRect(0, 0, w, h)
  ctx.font = font
  ctx.fillStyle = spec.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, pad + lineH * (i + 0.5))
  })

  return { dataUrl: canvas.toDataURL('image/png'), aspect: w / h }
}
