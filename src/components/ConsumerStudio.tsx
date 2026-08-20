import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStudio } from '../store'
import { BrandLockup } from './Brand'
import { Viewer } from './viewer/Viewer'
import { CameraBar } from './CameraBar'
import { ConsumerCustomizer } from './ConsumerCustomizer'
import { ChevronLeft, Download, Rotate, Cart } from './Icons'
import type { ProductDef, ExportBackground } from '../types'

/**
 * The consumer-facing studio: a big 3D view plus the slim customizer of
 * only the options the designer exposed. None of the designer authoring
 * chrome (parts, materials, tech pack, variants, export packs) is present.
 */
export function ConsumerStudio({ product }: { product: ProductDef }) {
  const closeProduct = useStudio((s) => s.closeProduct)
  const activeArticle = useStudio((s) => s.activeArticle)
  const autoRotate = useStudio((s) => s.autoRotate)
  const setAutoRotate = useStudio((s) => s.setAutoRotate)
  const exportFn = useStudio((s) => s.exportFn)
  const exporting = useStudio((s) => s.exporting)
  const setExporting = useStudio((s) => s.setExporting)
  const addToCart = useStudio((s) => s.addToCart)
  const setCartOpen = useStudio((s) => s.setCartOpen)
  const cartCount = useStudio((s) => s.cart.length)
  const [busy, setBusy] = useState(false)
  const [carting, setCarting] = useState(false)

  const onAddToCart = async () => {
    if (carting) return
    setCarting(true)
    try {
      await addToCart()
    } finally {
      setCarting(false)
    }
  }

  const download = async () => {
    if (!exportFn || exporting) return
    setExporting(true)
    setBusy(true)
    try {
      const bg: ExportBackground = 'studio'
      await exportFn({ background: bg, size: 2048 })
    } finally {
      setExporting(false)
      setBusy(false)
    }
  }

  return (
    <motion.main
      key={product.id}
      className="studio consumer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <header className="topnav">
        <div className="topnav-left">
          <BrandLockup variant="bar" showSub={false} />
          <button className="ghost-btn" onClick={closeProduct}>
            <ChevronLeft size={17} />
            <span>Catalog</span>
          </button>
        </div>
        <div className="topnav-center">
          <span className="consumer-title">{activeArticle?.name ?? product.name}</span>
        </div>
        <div className="topnav-right">
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
            className="icon-btn lg cart-btn"
            aria-label={`Cart (${cartCount})`}
            data-tip="Cart"
            onClick={() => setCartOpen(true)}
          >
            <Cart />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
          <button className="ghost-btn" disabled={exporting} onClick={download}>
            <Download size={16} />
            <span>{busy ? 'Rendering…' : 'Download'}</span>
          </button>
          <button className="primary-btn" disabled={carting} onClick={onAddToCart}>
            <Cart size={16} />
            <span>{carting ? 'Adding…' : 'Add to cart'}</span>
          </button>
        </div>
      </header>

      <div className="viewer-wrap">
        <Viewer product={product} />
        <CameraBar />
      </div>

      <aside className="panel panel-right consumer-panel" aria-label="Customize">
        <ConsumerCustomizer />
      </aside>
    </motion.main>
  )
}
