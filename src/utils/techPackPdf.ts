import { jsPDF } from 'jspdf'
import { presetById } from '../materials/presets'
import { describeTexture } from '../materials/patterns'
import type { Colorway, DecalLayer, PartState, Zone } from '../types'

interface TechPackData {
  productName: string
  parts: PartState[]
  layers: DecalLayer[]
  colorways: Colorway[]
  zones: Zone[]
  hero: string | null
}

const INK = '#1d1d1f'
const MUTE = '#6e6e73'
const LINE = '#d8d8dc'
const BRAND_BLUE = '#00AAE7'
const BRAND_GREEN = '#00BE40'

/** Build and download a production tech-pack PDF for the design. */
export function exportTechPackPdf(data: TechPackData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 40
  let y = M

  const setInk = (hex: string) => doc.setTextColor(hex)

  // ---- Header ---------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  setInk(INK)
  doc.text('Tech Pack', M, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  setInk(MUTE)
  doc.text(data.productName, M, y + 24)
  // Branded wordmark, right-aligned: "Studio" (blue) + "ERP" (green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  const wErp = doc.getTextWidth('ERP')
  const wStudio = doc.getTextWidth('Studio')
  const brandX = pageW - M - wErp - wStudio
  setInk(BRAND_BLUE)
  doc.text('Studio', brandX, y + 6)
  setInk(BRAND_GREEN)
  doc.text('ERP', brandX + wStudio, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(MUTE)
  doc.text('Article Creator', pageW - M, y + 20, { align: 'right' })
  y += 44
  doc.setDrawColor(LINE)
  doc.line(M, y, pageW - M, y)
  y += 20

  // ---- Hero render ----------------------------------------------------
  if (data.hero) {
    const size = 200
    try {
      doc.addImage(data.hero, 'PNG', M, y, size, size)
    } catch {
      /* skip if the image can't be embedded */
    }
    // Summary beside the hero
    const tx = M + size + 24
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    setInk(INK)
    doc.text('Summary', tx, y + 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    setInk(MUTE)
    const summary = [
      `Parts: ${data.parts.length}`,
      `Graphics: ${data.layers.length}`,
      `Colorways: ${data.colorways.length}`,
    ]
    summary.forEach((s, i) => doc.text(s, tx, y + 34 + i * 16))
    y += size + 24
  }

  // ---- Colorways ------------------------------------------------------
  if (data.colorways.length) {
    y = sectionTitle(doc, 'Colorways', M, y, pageW)
    const tw = 84
    const th = 70
    let cx = M
    for (const cw of data.colorways) {
      if (cx + tw > pageW - M) {
        cx = M
        y += th + 26
      }
      if (y + th > pageH - M) {
        doc.addPage()
        y = M
      }
      try {
        doc.addImage(cw.thumb, 'PNG', cx, y, tw, th)
      } catch {
        doc.setDrawColor(LINE)
        doc.rect(cx, y, tw, th)
      }
      doc.setFontSize(8)
      setInk(MUTE)
      doc.text(cw.name.slice(0, 16), cx, y + th + 12)
      cx += tw + 14
    }
    y += th + 28
  }

  // ---- Parts & treatments table --------------------------------------
  y = ensureSpace(doc, y, 80, M)
  y = sectionTitle(doc, 'Parts & Treatments', M, y, pageW)
  const cols = [M, M + 130, M + 250, M + 360]
  doc.setFontSize(8)
  setInk(MUTE)
  doc.text('PART', cols[0], y)
  doc.text('COLOR', cols[1], y)
  doc.text('TREATMENT', cols[2], y)
  doc.text('NOTES', cols[3], y)
  y += 6
  doc.setDrawColor(LINE)
  doc.line(M, y, pageW - M, y)
  y += 14
  doc.setFontSize(10)
  for (const p of data.parts) {
    y = ensureSpace(doc, y, p.texture ? 42 : 26, M)
    setInk(INK)
    doc.setFont('helvetica', 'bold')
    doc.text(p.label, cols[0], y)
    doc.setFont('helvetica', 'normal')
    // color swatch
    doc.setFillColor(p.color)
    doc.setDrawColor(LINE)
    doc.roundedRect(cols[1], y - 8, 10, 10, 2, 2, 'FD')
    setInk(MUTE)
    doc.text(p.color.toUpperCase(), cols[1] + 16, y)
    const preset = presetById(p.preset)
    doc.text(
      `${preset.label}  ·  R ${p.roughness.toFixed(2)} M ${p.metalness.toFixed(2)}`,
      cols[2],
      y,
    )
    const note = (p.note ?? '').slice(0, 34)
    doc.text(note || '—', cols[3], y)
    // Pattern / texture: tile swatch + spec on a second line under treatment.
    if (p.texture) {
      try {
        doc.addImage(p.texture.src, 'PNG', cols[2], y + 4, 10, 10)
      } catch {
        /* skip unembeddable image */
      }
      doc.setFontSize(8)
      setInk(MUTE)
      doc.text(`Print: ${describeTexture(p.texture)}`, cols[2] + 15, y + 11)
      doc.setFontSize(10)
      y += 16
    }
    y += 22
  }

  // ---- Graphics -------------------------------------------------------
  if (data.layers.length) {
    y = ensureSpace(doc, y, 60, M)
    y += 10
    y = sectionTitle(doc, 'Graphics', M, y, pageW)
    doc.setFontSize(8)
    setInk(MUTE)
    doc.text('ARTWORK', cols[0], y)
    doc.text('PLACEMENT', cols[1], y)
    doc.text('SIZE', cols[2], y)
    doc.text('DETAILS', cols[3], y)
    y += 6
    doc.line(M, y, pageW - M, y)
    y += 14
    doc.setFontSize(10)
    for (const l of data.layers) {
      y = ensureSpace(doc, y, 30, M)
      try {
        doc.addImage(l.image, 'PNG', cols[0], y - 12, 16, 16)
      } catch {
        /* ignore */
      }
      setInk(INK)
      doc.text(l.name.slice(0, 18), cols[0] + 22, y)
      const zone = data.zones.find((z) => z.id === l.zoneId)
      setInk(MUTE)
      doc.text(zone ? zone.label : `Custom (${l.mesh})`, cols[1], y)
      doc.text(l.scale.toFixed(2), cols[2], y)
      doc.text(
        `${Math.round((l.spin * 180) / Math.PI)}°  ·  ${Math.round(l.opacity * 100)}%${l.flipX ? '  · flipped' : ''}`,
        cols[3],
        y,
      )
      y += 24
    }
  }

  doc.save(`${data.productName.replace(/\s+/g, '-').toLowerCase()}-techpack.pdf`)
}

function sectionTitle(
  doc: jsPDF,
  title: string,
  x: number,
  y: number,
  _pageW: number,
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(INK)
  doc.text(title, x, y)
  doc.setFont('helvetica', 'normal')
  return y + 20
}

function ensureSpace(doc: jsPDF, y: number, need: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + need > pageH - margin) {
    doc.addPage()
    return margin + 10
  }
  return y
}
