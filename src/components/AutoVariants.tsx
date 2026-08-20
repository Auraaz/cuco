import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStudio } from '../store'
import {
  csvTemplate,
  fetchGoogleSheet,
  parseSheet,
  type ParsedSheet,
} from '../utils/sheet'
import type { GraphicResolver, VariantRow } from '../utils/variants'
import type { DesignVariable, VariableType } from '../types'
import { productById } from '../products/catalog'
import { VariantBuilder } from './VariantBuilder'
import { Close, Download } from './Icons'

const TYPE_LABEL: Record<VariableType, string> = {
  color: 'Color',
  text: 'Text',
  graphic: 'Artwork',
  placement: 'Placement',
  font: 'Font',
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Auto Variants — turn the marked variables into a spreadsheet, then
 * generate one colorway per row (values may be colors, text, artwork
 * filenames, or placements) and optionally export a render pack.
 */
export function AutoVariants() {
  const open = useStudio((s) => s.variantsOpen)
  const setOpen = useStudio((s) => s.setVariantsOpen)
  const productId = useStudio((s) => s.productId)
  const variables = useStudio((s) => s.variables)
  const layers = useStudio((s) => s.layers)
  const parts = useStudio((s) => s.parts)
  const groups = useStudio((s) => s.groups)
  const colorways = useStudio((s) => s.colorways)
  const removeVariable = useStudio((s) => s.removeVariable)
  const setVariableEditable = useStudio((s) => s.setVariableEditable)
  const generateVariants = useStudio((s) => s.generateVariants)
  const exportVariantPack = useStudio((s) => s.exportVariantPack)
  const clearGenerated = useStudio((s) => s.clearGeneratedColorways)
  const setTechPackOpen = useStudio((s) => s.setTechPackOpen)
  const progress = useStudio((s) => s.variantProgress)
  const toast = useStudio((s) => s.toast)

  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [images, setImages] = useState<{ name: string; url: string }[]>([])
  const [parseErr, setParseErr] = useState('')
  const [gUrl, setGUrl] = useState('')
  const [gLoading, setGLoading] = useState(false)
  const sheetRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  const generatedCount = colorways.filter((c) => c.generated).length
  const busy = progress !== null
  const needsImages = variables.some((v) => v.type === 'graphic')

  /* Which spreadsheet columns line up with which variables. */
  const mapping = useMemo(() => {
    if (!sheet) return null
    const headerSet = new Set(sheet.headers.map((h) => h.toLowerCase()))
    const matched = variables.filter((v) => headerSet.has(v.name.toLowerCase()))
    const missing = variables.filter((v) => !headerSet.has(v.name.toLowerCase()))
    const varNames = new Set(variables.map((v) => v.name.toLowerCase()))
    const extra = sheet.headers.filter(
      (h) => !varNames.has(h.toLowerCase()) && !/^(name|variant|colorway|title|sku|style)$/i.test(h),
    )
    return { matched, missing, extra }
  }, [sheet, variables])

  const onTemplate = () => {
    download(
      new Blob([csvTemplate(variables)], { type: 'text/csv' }),
      `${productId ?? 'design'}-variants-template.csv`,
    )
  }

  const onSheet = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setParseErr('')
    try {
      const parsed = await parseSheet(file)
      if (parsed.rows.length === 0) {
        setParseErr('No data rows found. Add a header row and at least one row of values.')
        setSheet(null)
        return
      }
      setSheet(parsed)
      setSheetName(file.name)
    } catch {
      setParseErr("Couldn't read that file — use an .xlsx or .csv.")
      setSheet(null)
    }
  }

  const onLoadGoogle = async () => {
    if (!gUrl.trim() || gLoading) return
    setParseErr('')
    setGLoading(true)
    try {
      const parsed = await fetchGoogleSheet(gUrl)
      setSheet(parsed)
      setSheetName('Google Sheet')
    } catch (e) {
      setSheet(null)
      setParseErr(e instanceof Error ? e.message : "Couldn't load that sheet.")
    } finally {
      setGLoading(false)
    }
  }

  const onImages = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const next: { name: string; url: string }[] = []
    for (const f of files) {
      try {
        next.push({ name: f.name, url: await readAsDataUrl(f) })
      } catch {
        /* skip */
      }
    }
    setImages((prev) => {
      const merged = [...prev]
      for (const n of next) {
        const i = merged.findIndex((m) => m.name.toLowerCase() === n.name.toLowerCase())
        if (i >= 0) merged[i] = n
        else merged.push(n)
      }
      return merged
    })
  }

  const buildResolver = (): GraphicResolver => {
    const imgMap = new Map<string, string>()
    for (const im of images) {
      const b = im.name.toLowerCase()
      imgMap.set(b, im.url)
      imgMap.set(b.replace(/\.[^.]+$/, ''), im.url)
    }
    const layerMap = new Map<string, string>()
    for (const l of layers) layerMap.set(l.name.toLowerCase(), l.image)
    return async (value) => {
      const v = value.trim()
      if (!v) return null
      if (/^data:/i.test(v)) return v
      if (/^https?:\/\//i.test(v)) {
        try {
          const res = await fetch(v)
          return await blobToDataUrl(await res.blob())
        } catch {
          return null
        }
      }
      const base = v.split(/[\\/]/).pop()!.toLowerCase()
      const noExt = base.replace(/\.[^.]+$/, '')
      return imgMap.get(base) ?? imgMap.get(noExt) ?? layerMap.get(noExt) ?? layerMap.get(base) ?? null
    }
  }

  const onGenerate = async () => {
    if (!sheet || busy) return
    const n = await generateVariants(sheet.rows, buildResolver())
    toast(n > 0 ? `Generated ${n} colorway${n === 1 ? '' : 's'}` : 'Nothing to generate')
  }

  /* In-app grid → same generation pipeline (no spreadsheet needed). */
  const product = productId ? productById(productId) : undefined
  const zones = product?.zones ?? []

  const seedValue = (v: DesignVariable): string => {
    const t = v.target
    if (t.kind === 'partColor') return parts.find((p) => p.id === t.partId)?.color ?? '#D4D4D8'
    if (t.kind === 'groupColor') {
      const g = groups.find((gr) => gr.id === t.groupId)
      const first = g && parts.find((p) => g.partIds.includes(p.id))
      return first?.color ?? '#D4D4D8'
    }
    if (t.kind === 'layerTextColor') return layers.find((l) => l.id === t.layerId)?.text?.color ?? '#18181B'
    if (t.kind === 'layerText') return layers.find((l) => l.id === t.layerId)?.text?.content ?? ''
    if (t.kind === 'layerTextFont') return layers.find((l) => l.id === t.layerId)?.text?.font ?? 'sans'
    if (t.kind === 'layerPlacement') return layers.find((l) => l.id === t.layerId)?.zoneId ?? ''
    return '' /* layerImage — filled by filename/URL */
  }

  const onGenerateRows = async (rows: VariantRow[]) => {
    if (busy || rows.length === 0) return
    const n = await generateVariants(rows, buildResolver())
    toast(n > 0 ? `Generated ${n} colorway${n === 1 ? '' : 's'}` : 'Nothing to generate')
  }

  const onExport = async () => {
    if (busy) return
    const ids = colorways.filter((c) => c.generated).map((c) => c.id)
    if (ids.length === 0) return
    const blob = await exportVariantPack(ids)
    if (blob) {
      download(blob, `${productId ?? 'design'}-variant-pack.zip`)
      toast('Variant pack downloaded')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="variants-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false)
          }}
        >
          <motion.div
            className="variants-modal"
            role="dialog"
            aria-label="Auto variants"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="variants-head">
              <div>
                <h2>Auto Variants</h2>
                <p>Drive a spreadsheet from your design and batch-generate colorways.</p>
              </div>
              <button
                className="icon-btn lg"
                aria-label="Close"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                <Close />
              </button>
            </header>

            <div className="variants-body">
              {/* Step 1 — variables */}
              <section className="variants-section">
                <h3 className="section-label">
                  1 · Variables <span className="browse-count">{variables.length}</span>
                </h3>
                {variables.length === 0 ? (
                  <p className="editor-empty small">
                    Nothing is variable yet. In the editor, use{' '}
                    <strong>Make variable</strong> on a part color, a text or
                    artwork layer, or a placement — each becomes a spreadsheet
                    column here.
                  </p>
                ) : (
                  <div className="var-list">
                    {variables.map((v: DesignVariable) => (
                      <div key={v.id} className="var-item">
                        <span className={`var-type-chip ${v.type}`}>{TYPE_LABEL[v.type]}</span>
                        <span className="var-item-name">{v.name}</span>
                        <span className="var-item-target">{v.label}</span>
                        <button
                          className={`var-editable ${v.editable ? 'is-on' : ''}`}
                          role="switch"
                          aria-checked={!!v.editable}
                          title={
                            v.editable
                              ? 'Consumers can edit this option — click to hide it'
                              : 'Let consumers edit this option in the published article'
                          }
                          onClick={() => setVariableEditable(v.id, !v.editable)}
                        >
                          <span className="var-editable-dot" aria-hidden />
                          {v.editable ? 'Editable' : 'Designer only'}
                        </button>
                        <button
                          className="icon-btn var-item-del"
                          aria-label={`Remove variable ${v.name}`}
                          onClick={() => removeVariable(v.id)}
                        >
                          <Close size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {variables.length > 0 && (
                  <p className="editor-hint">
                    Mark a variable <strong>Editable</strong> to expose it to
                    consumers when you publish — they'll only see editable options.
                  </p>
                )}
              </section>

              {/* Step 2 — data */}
              <section className="variants-section">
                <h3 className="section-label">2 · Spreadsheet</h3>
                <div className="variants-actions">
                  <button
                    className="primary-btn outline"
                    disabled={variables.length === 0}
                    onClick={onTemplate}
                  >
                    <Download size={15} />
                    <span>Download CSV template</span>
                  </button>
                  <button
                    className="primary-btn"
                    disabled={variables.length === 0}
                    onClick={() => sheetRef.current?.click()}
                  >
                    {sheet ? 'Replace spreadsheet…' : 'Upload .xlsx / .csv…'}
                  </button>
                  {needsImages && (
                    <button className="primary-btn outline" onClick={() => imgRef.current?.click()}>
                      {images.length ? `Images · ${images.length}` : 'Upload artwork files…'}
                    </button>
                  )}
                </div>
                <input
                  ref={sheetRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  hidden
                  onChange={onSheet}
                />
                <input
                  ref={imgRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  multiple
                  hidden
                  onChange={onImages}
                />
                {needsImages && (
                  <p className="editor-hint">
                    Your sheet has an artwork column, so filenames in it (e.g.
                    <code>logo.png</code>) are matched to the artwork files you
                    upload here.
                  </p>
                )}

                <div className="variants-or">
                  <span>or paste a public Google Sheets link</span>
                </div>
                <div className="gsheet-row">
                  <input
                    className="search-input gsheet-input"
                    type="url"
                    inputMode="url"
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    value={gUrl}
                    disabled={variables.length === 0 || gLoading}
                    aria-label="Google Sheets link"
                    onChange={(e) => setGUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onLoadGoogle()}
                  />
                  <button
                    className="primary-btn"
                    disabled={variables.length === 0 || gLoading || !gUrl.trim()}
                    onClick={onLoadGoogle}
                  >
                    {gLoading ? 'Loading…' : 'Load'}
                  </button>
                </div>
                <p className="editor-hint">
                  Share the sheet as <strong>Anyone with the link</strong> (or
                  publish it to the web), then paste the link — the first tab
                  is read, or the specific tab in the link's <code>gid</code>.
                </p>

                <div className="variants-or">
                  <span>or build rows here — no file needed</span>
                </div>
                <VariantBuilder
                  variables={variables}
                  zones={zones}
                  seedValue={seedValue}
                  busy={busy}
                  onGenerate={onGenerateRows}
                />

                {parseErr && <p className="variants-warn">{parseErr}</p>}

                {sheet && mapping && (
                  <div className="variants-preview">
                    <div className="variants-mapline">
                      <strong>{sheetName}</strong> — {sheet.rows.length} row
                      {sheet.rows.length === 1 ? '' : 's'}
                      {mapping.matched.length > 0 && (
                        <span className="map-ok"> · {mapping.matched.length} column{mapping.matched.length === 1 ? '' : 's'} matched</span>
                      )}
                      {mapping.missing.length > 0 && (
                        <span className="map-warn"> · missing: {mapping.missing.map((v) => v.name).join(', ')}</span>
                      )}
                      {mapping.extra.length > 0 && (
                        <span className="map-muted"> · ignored: {mapping.extra.join(', ')}</span>
                      )}
                    </div>
                    <div className="variants-table-wrap">
                      <table className="variants-table">
                        <thead>
                          <tr>
                            {sheet.headers.map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.rows.slice(0, 5).map((r, i) => (
                            <tr key={i}>
                              {sheet.headers.map((h) => (
                                <td key={h}>{r.values[h] ?? ''}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {sheet.rows.length > 5 && (
                        <p className="variants-more">+{sheet.rows.length - 5} more…</p>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Step 3 — generate */}
              <section className="variants-section">
                <h3 className="section-label">3 · Generate</h3>
                {busy ? (
                  <div className="variants-progress">
                    <div className="variants-bar">
                      <span
                        style={{
                          width: `${progress ? (progress.done / progress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="variants-progress-label">
                      {progress?.phase === 'export' ? 'Rendering pack' : 'Generating'} {progress?.done}/
                      {progress?.total}
                    </span>
                  </div>
                ) : (
                  <div className="variants-actions">
                    <button
                      className="primary-btn"
                      disabled={!sheet || variables.length === 0}
                      onClick={onGenerate}
                    >
                      {sheet ? `Generate ${sheet.rows.length} colorway${sheet.rows.length === 1 ? '' : 's'}` : 'Generate colorways'}
                    </button>
                    <button
                      className="primary-btn outline"
                      disabled={generatedCount === 0}
                      onClick={onExport}
                    >
                      <Download size={15} />
                      <span>Export pack (ZIP)</span>
                    </button>
                  </div>
                )}

                {generatedCount > 0 && !busy && (
                  <p className="variants-done">
                    {generatedCount} generated colorway{generatedCount === 1 ? '' : 's'} in your library.{' '}
                    <button
                      className="linky"
                      onClick={() => {
                        setOpen(false)
                        setTechPackOpen(true)
                      }}
                    >
                      View in Tech Pack
                    </button>{' '}
                    ·{' '}
                    <button className="linky" onClick={clearGenerated}>
                      Clear generated
                    </button>
                  </p>
                )}
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
