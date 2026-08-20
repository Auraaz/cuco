import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStudio } from '../store'
import { productById } from '../products/catalog'
import { presetById } from '../materials/presets'
import { describeTexture } from '../materials/patterns'
import { exportTechPackPdf } from '../utils/techPackPdf'
import { Close, Download } from './Icons'

/**
 * Tech Pack — the production-facing summary of the design: colorway
 * snapshots (click to load), a parts table with colors and treatments,
 * and the applied graphics.
 */
export function TechPack() {
  const open = useStudio((s) => s.techPackOpen)
  const setOpen = useStudio((s) => s.setTechPackOpen)
  const productId = useStudio((s) => s.productId)
  const parts = useStudio((s) => s.parts)
  const layers = useStudio((s) => s.layers)
  const colorways = useStudio((s) => s.colorways)
  const addColorway = useStudio((s) => s.addColorway)
  const applyColorway = useStudio((s) => s.applyColorway)
  const removeColorway = useStudio((s) => s.removeColorway)
  const renameColorway = useStudio((s) => s.renameColorway)
  const updatePart = useStudio((s) => s.updatePart)
  const captureFn = useStudio((s) => s.captureFn)
  const toast = useStudio((s) => s.toast)

  const [snapping, setSnapping] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const product = productId ? productById(productId) : undefined

  const exportPdf = async () => {
    if (!product || pdfBusy) return
    setPdfBusy(true)
    try {
      const hero = captureFn ? await captureFn(600) : null
      exportTechPackPdf({
        productName: product.name,
        parts,
        layers,
        colorways,
        zones: product.zones,
        hero,
      })
      toast('Tech pack PDF downloaded')
    } finally {
      setPdfBusy(false)
    }
  }

  const snap = async () => {
    if (snapping) return
    setSnapping(true)
    try {
      await addColorway()
    } finally {
      setSnapping(false)
    }
  }

  const load = (id: string) => {
    applyColorway(id)
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && product && (
        <motion.div
          className="techpack"
          /* Slide up fully opaque (no opacity fade-in) so the inspector
             never shows through during the transition. */
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className="techpack-head">
            <div>
              <h2>Tech Pack</h2>
              <p>{product.name}</p>
            </div>
            <div className="techpack-head-actions">
              <button
                className="primary-btn"
                disabled={pdfBusy}
                onClick={exportPdf}
              >
                <Download size={16} />
                <span>{pdfBusy ? 'Building…' : 'Export PDF'}</span>
              </button>
              <button
                className="icon-btn lg"
                aria-label="Close tech pack"
                onClick={() => setOpen(false)}
              >
                <Close />
              </button>
            </div>
          </header>

          <div className="techpack-body">
            <section className="techpack-section">
              <h3 className="section-label">Colorways</h3>
              <div className="colorway-row">
                <button
                  className="colorway-add"
                  disabled={snapping}
                  onClick={snap}
                >
                  <span className="colorway-add-icon">📷</span>
                  {snapping ? 'Capturing…' : 'Snapshot'}
                </button>

                {colorways.map((cw) => (
                  <div key={cw.id} className="colorway-card">
                    <button
                      className="colorway-thumb"
                      title={`Load ${cw.name}`}
                      onClick={() => load(cw.id)}
                    >
                      <img src={cw.thumb} alt={cw.name} />
                    </button>
                    <div className="colorway-meta">
                      <input
                        className="colorway-name"
                        value={cw.name}
                        aria-label="Colorway name"
                        onChange={(e) => renameColorway(cw.id, e.target.value)}
                      />
                      <button
                        className="icon-btn colorway-del"
                        aria-label={`Delete ${cw.name}`}
                        onClick={() => removeColorway(cw.id)}
                      >
                        <Close size={14} />
                      </button>
                    </div>
                    <div className="colorway-dots">
                      {cw.parts.slice(0, 6).map((p) => (
                        <span
                          key={p.id}
                          className="part-dot sm"
                          style={{ background: p.color }}
                          title={`${p.label} ${p.color}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {colorways.length === 0 && (
                <p className="editor-empty small">
                  Snapshot the current design to start a colorway library.
                  Click any colorway to load it — colors, materials and
                  graphics included.
                </p>
              )}
            </section>

            <section className="techpack-section">
              <h3 className="section-label">Parts &amp; Treatments</h3>
              <div className="tp-table">
                <div className="tp-row tp-head">
                  <span>Part</span>
                  <span>Color</span>
                  <span>Treatment</span>
                  <span>Notes</span>
                </div>
                {parts.map((p) => (
                  <div key={p.id} className={`tp-row ${p.visible ? '' : 'tp-hidden'}`}>
                    <span className="tp-part">{p.label}</span>
                    <span className="tp-color">
                      <span className="part-dot" style={{ background: p.color }} />
                      <code>{p.color.toUpperCase()}</code>
                    </span>
                    <span className="tp-treatment">
                      {presetById(p.preset).label}
                      <small>
                        R {p.roughness.toFixed(2)} · M {p.metalness.toFixed(2)}
                        {p.visible ? '' : ' · hidden'}
                      </small>
                      {p.texture && (
                        <span className="tp-print">
                          <img className="tp-print-swatch" src={p.texture.src} alt="" />
                          Print: {describeTexture(p.texture)}
                        </span>
                      )}
                    </span>
                    <input
                      className="tp-note"
                      placeholder="Add note…"
                      value={p.note ?? ''}
                      aria-label={`Treatment note for ${p.label}`}
                      onChange={(e) => updatePart(p.id, { note: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="techpack-section">
              <h3 className="section-label">Graphics</h3>
              {layers.length === 0 ? (
                <p className="editor-empty small">No artwork applied.</p>
              ) : (
                <div className="tp-table">
                  <div className="tp-row tp-head gfx">
                    <span>Artwork</span>
                    <span>Placement</span>
                    <span>Size</span>
                    <span>Details</span>
                  </div>
                  {layers.map((l) => {
                    const zone = product.zones.find((z) => z.id === l.zoneId)
                    return (
                      <div key={l.id} className={`tp-row gfx ${l.visible ? '' : 'tp-hidden'}`}>
                        <span className="tp-part gfx-name">
                          <img className="layer-thumb" src={l.image} alt="" />
                          {l.name}
                        </span>
                        <span>{zone ? zone.label : `Custom (${l.mesh})`}</span>
                        <span>{l.scale.toFixed(2)}</span>
                        <span className="tp-treatment">
                          <small>
                            {Math.round((l.spin * 180) / Math.PI)}° ·{' '}
                            {Math.round(l.opacity * 100)}%
                            {l.flipX ? ' · flipped' : ''}
                            {l.visible ? '' : ' · hidden'}
                          </small>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
