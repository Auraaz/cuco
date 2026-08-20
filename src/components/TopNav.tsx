import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStudio } from '../store'
import { PRODUCTS, productById } from '../products/catalog'
import { markDesignSaved } from '../persistence'
import { BrandLockup } from './Brand'
import { RoleSwitch } from './RoleSwitch'
import { PublishDialog } from './PublishDialog'
import { ChevronLeft, Doc, Download, Layers, Redo, Rotate, Undo, Upload } from './Icons'
import type { ExportBackground } from '../types'

const BACKGROUNDS: { id: ExportBackground; label: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'white', label: 'White' },
  { id: 'transparent', label: 'Transparent' },
]

export function TopNav() {
  const productId = useStudio((s) => s.productId)
  const closeProduct = useStudio((s) => s.closeProduct)
  const autoRotate = useStudio((s) => s.autoRotate)
  const setAutoRotate = useStudio((s) => s.setAutoRotate)
  const undo = useStudio((s) => s.undo)
  const redo = useStudio((s) => s.redo)
  const canUndo = useStudio((s) => s.canUndo)
  const canRedo = useStudio((s) => s.canRedo)
  const exportFn = useStudio((s) => s.exportFn)
  const exportHeroFn = useStudio((s) => s.exportHeroFn)
  const serializeDesign = useStudio((s) => s.serializeDesign)
  const exporting = useStudio((s) => s.exporting)
  const setExporting = useStudio((s) => s.setExporting)
  const techPackOpen = useStudio((s) => s.techPackOpen)
  const setTechPackOpen = useStudio((s) => s.setTechPackOpen)
  const variantsOpen = useStudio((s) => s.variantsOpen)
  const setVariantsOpen = useStudio((s) => s.setVariantsOpen)
  const resetParts = useStudio((s) => s.resetParts)
  const toast = useStudio((s) => s.toast)

  const openProduct = useStudio((s) => s.openProduct)

  const [menuOpen, setMenuOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [background, setBackground] = useState<ExportBackground>(() => {
    try {
      const saved = localStorage.getItem('apparel-studio:export-bg')
      return (saved as ExportBackground) || 'studio'
    } catch {
      return 'studio'
    }
  })

  const chooseBackground = (bg: ExportBackground) => {
    setBackground(bg)
    try {
      localStorage.setItem('apparel-studio:export-bg', bg)
    } catch {
      /* ignore */
    }
  }
  const [busy, setBusy] = useState<'png' | 'pack' | null>(null)
  const exportBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const switcherRef = useRef<HTMLDivElement>(null)

  const product = productId ? productById(productId) : undefined

  /* Dismiss the product switcher on Escape or outside-click. */
  useEffect(() => {
    if (!switcherOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSwitcherOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!switcherRef.current?.contains(e.target as Node)) setSwitcherOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [switcherOpen])

  /* Dismiss the export popover on Escape or outside-click, returning
     focus to the trigger. */
  useEffect(() => {
    if (!menuOpen) return
    const close = () => {
      setMenuOpen(false)
      exportBtnRef.current?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    const onDown = (e: PointerEvent | MouseEvent) => {
      const t = e.target as Node
      if (
        !menuRef.current?.contains(t) &&
        !exportBtnRef.current?.contains(t)
      ) {
        setMenuOpen(false)
      }
    }
    const onBlur = () => setMenuOpen(false)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [menuOpen])

  const run = async (kind: 'png' | 'pack') => {
    const fn = kind === 'png' ? exportFn : exportHeroFn
    if (!fn || exporting) return
    setExporting(true)
    setBusy(kind)
    try {
      await fn({ background, size: 2048 })
    } finally {
      setExporting(false)
      setBusy(null)
      setMenuOpen(false)
    }
  }

  const saveDesign = () => {
    const config = serializeDesign()
    if (!config) return
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${config.productId}-design.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    markDesignSaved()
    toast('Design saved to file')
    setMenuOpen(false)
  }

  const doReset = () => {
    resetParts()
    toast('Design reset')
  }

  return (
    <header className="topnav">
      <div className="topnav-left">
        <BrandLockup variant="bar" showSub={false} />
        <button className="ghost-btn" onClick={closeProduct}>
          <ChevronLeft size={17} />
          <span>Products</span>
        </button>
        <RoleSwitch compact />
      </div>

      <div className="topnav-center" ref={switcherRef}>
        <button
          className="switcher-btn"
          aria-haspopup="menu"
          aria-expanded={switcherOpen}
          title="Switch product"
          onClick={() => setSwitcherOpen((v) => !v)}
        >
          {product?.name ?? 'StudioERP'}
          <span className={`chevron ${switcherOpen ? 'open' : ''}`} aria-hidden>
            ›
          </span>
        </button>
        <AnimatePresence>
          {switcherOpen && (
            <motion.div
              className="switcher-menu"
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {PRODUCTS.map((p) => (
                <button
                  key={p.id}
                  className={`switcher-item ${p.id === productId ? 'is-active' : ''}`}
                  onClick={() => {
                    if (p.id !== productId) openProduct(p.id)
                    setSwitcherOpen(false)
                  }}
                >
                  <span className="switcher-glyph" aria-hidden>
                    {p.glyph}
                  </span>
                  {p.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="topnav-right">
        <button
          className="icon-btn lg"
          aria-label="Undo"
          data-tip="Undo · Ctrl Z"
          disabled={!canUndo}
          onClick={undo}
        >
          <Undo />
        </button>
        <button
          className="icon-btn lg"
          aria-label="Redo"
          data-tip="Redo · Ctrl ⇧ Z"
          disabled={!canRedo}
          onClick={redo}
        >
          <Redo />
        </button>
        <button
          className={`icon-btn lg ${autoRotate ? 'is-active' : ''}`}
          aria-label="Toggle auto-rotate"
          aria-pressed={autoRotate}
          data-tip="Auto-rotate · Space"
          onClick={() => setAutoRotate(!autoRotate)}
        >
          <Rotate />
        </button>
        <button
          className={`icon-btn lg ${techPackOpen ? 'is-active' : ''}`}
          aria-label="Tech pack"
          aria-pressed={techPackOpen}
          data-tip="Tech Pack"
          onClick={() => setTechPackOpen(!techPackOpen)}
        >
          <Doc />
        </button>
        <button
          className={`icon-btn lg ${variantsOpen ? 'is-active' : ''}`}
          aria-label="Auto variants"
          aria-pressed={variantsOpen}
          data-tip="Auto Variants"
          onClick={() => setVariantsOpen(!variantsOpen)}
        >
          <Layers />
        </button>

        <button
          className="primary-btn outline publish-btn"
          title="Publish this design to the catalog for consumers"
          onClick={() => setPublishOpen(true)}
        >
          <Upload size={16} />
          <span>Publish</span>
        </button>

        <div className="export-anchor">
          <button
            ref={exportBtnRef}
            className="primary-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Export & design actions"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Download size={16} />
            <span>Export</span>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                ref={menuRef}
                className="export-menu"
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                <h4 className="section-label">Background</h4>
                <div className="preset-grid">
                  {BACKGROUNDS.map((b) => (
                    <button
                      key={b.id}
                      className={`chip ${background === b.id ? 'is-active' : ''}`}
                      onClick={() => chooseBackground(b.id)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                <p className="export-hint">PNG · 2048 px</p>
                <button
                  className="primary-btn full"
                  disabled={exporting}
                  onClick={() => run('png')}
                >
                  {busy === 'png' ? 'Rendering…' : 'Download current view'}
                </button>
                <button
                  className="primary-btn full outline"
                  disabled={exporting}
                  onClick={() => run('pack')}
                >
                  {busy === 'pack' ? 'Rendering 6 views…' : 'Hero pack · 6 views (ZIP)'}
                </button>
                <button
                  className="primary-btn full outline"
                  disabled={exporting}
                  onClick={saveDesign}
                >
                  Save design (JSON)
                </button>
                <button
                  className="menu-text-btn"
                  onClick={() => {
                    doReset()
                    setMenuOpen(false)
                  }}
                >
                  Reset design
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />
    </header>
  )
}
