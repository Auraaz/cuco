import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import {
  AUDIENCE_LABELS,
  CATEGORY_LABELS,
  PRODUCTS,
  loadCustomGlb,
  productById,
} from '../products/catalog'
import { useStudio } from '../store'
import { BrandLockup } from './Brand'
import { RoleSwitch } from './RoleSwitch'
import { openRemoteModel } from '../utils/remoteModel'
import { clearDraft, readDraft, readRecents } from '../persistence'
import type { Audience, DesignConfig, ProductCategory, ProductDef } from '../types'

const CATEGORY_ORDER: ProductCategory[] = ['tops', 'bottoms', 'accessories']
const AUDIENCES: Audience[] = ['men', 'women', 'kids']

/** A single template card. */
function ProductCard({
  product,
  index,
  onOpen,
}: {
  product: ProductDef
  index: number
  onOpen: (id: string) => void
}) {
  /* Open only when press + release happen on THIS card with little
     movement. Guards against two failure modes: the tap-scale animation
     shifting the release onto a neighbouring card (which opened the wrong
     product), and a scroll drag being read as a tap. */
  const down = useRef<{ x: number; y: number } | null>(null)
  return (
    <motion.button
      type="button"
      className="product-card"
      style={{ background: product.tint }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: 'easeOut' }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        const d = down.current
        down.current = null
        if (!d) return /* press started on a different card */
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return /* a drag/scroll */
        onOpen(product.id)
      }}
    >
      <img
        className="product-thumb"
        src={`${import.meta.env.BASE_URL}thumbs/${product.id}.png`}
        alt=""
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget
          img.style.display = 'none'
          img.nextElementSibling?.removeAttribute('hidden')
        }}
      />
      <span className="product-glyph" aria-hidden hidden>
        {product.glyph}
      </span>
      <span className="product-name">{product.name}</span>
      <span className="product-cta">Customize</span>
    </motion.button>
  )
}

/** Home page — browse and filter templates by category and audience. */
export function ProductPicker() {
  const openProduct = useStudio((s) => s.openProduct)
  const openDesign = useStudio((s) => s.openDesign)
  const fileRef = useRef<HTMLInputElement>(null)
  const modelRef = useRef<HTMLInputElement>(null)
  const [modelUrl, setModelUrl] = useState('')
  const [urlBusy, setUrlBusy] = useState(false)
  const [urlError, setUrlError] = useState('')

  const onModelFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const def = loadCustomGlb(file)
    openProduct(def.id)
  }

  const loadFromUrl = async () => {
    if (urlBusy || !modelUrl.trim()) return
    setUrlError('')
    setUrlBusy(true)
    const res = await openRemoteModel(modelUrl)
    setUrlBusy(false)
    if (!res.ok) setUrlError(res.reason)
    /* On success the product opens and this view unmounts. */
  }

  const [category, setCategory] = useState<ProductCategory | 'all'>('all')
  const [audience, setAudience] = useState<Audience | 'all'>('all')
  const [query, setQuery] = useState('')

  const [draft, setDraft] = useState<DesignConfig | null>(() => readDraft())
  const draftProduct = draft ? productById(draft.productId) : undefined
  const recents = useMemo(
    () => readRecents().map(productById).filter(Boolean) as ProductDef[],
    [],
  )

  const onDesignFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const config = JSON.parse(String(reader.result)) as DesignConfig
        if (config.app === 'apparel-studio' && productById(config.productId)) {
          openDesign(config)
        }
      } catch {
        /* not a valid design file */
      }
    }
    reader.readAsText(file)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PRODUCTS.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (audience === 'all' || p.audiences.includes(audience)) &&
        (!q || p.name.toLowerCase().includes(q)),
    )
  }, [category, audience, query])

  const showAll = category === 'all' && audience === 'all' && !query
  const hasFilters = category !== 'all' || audience !== 'all' || query !== ''

  const reset = () => {
    setCategory('all')
    setAudience('all')
    setQuery('')
  }

  /* When browsing everything, group by category with headers. */
  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: filtered.filter((p) => p.category === cat),
    })).filter((g) => g.items.length > 0)
  }, [filtered])

  return (
    <div className="browse">
      <motion.header
        className="browse-head"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <BrandLockup variant="hero" />
        <p>Browse a template to start designing. Colors, materials and artwork update live in 3D.</p>
        <div className="browse-role"><RoleSwitch /></div>
      </motion.header>

      {/* Resume the last design */}
      {draft && draftProduct && (
        <div className="resume-card">
          {draft.colorways?.[0]?.thumb ? (
            <img className="resume-thumb" src={draft.colorways[0].thumb} alt="" />
          ) : (
            <img
              className="resume-thumb"
              src={`${import.meta.env.BASE_URL}thumbs/${draftProduct.id}.png`}
              alt=""
            />
          )}
          <div className="resume-text">
            <strong>Continue where you left off</strong>
            <span>
              {draftProduct.name}
              {draft.layers.length
                ? ` · ${draft.layers.length} graphic${draft.layers.length > 1 ? 's' : ''}`
                : ''}
            </span>
          </div>
          <button className="primary-btn" onClick={() => openDesign(draft)}>
            Resume
          </button>
          <button
            className="menu-text-btn"
            onClick={() => {
              clearDraft()
              setDraft(null)
            }}
          >
            Discard
          </button>
        </div>
      )}

      {/* Recently opened */}
      {recents.length > 0 && (
        <section className="browse-section">
          <h2 className="browse-section-title">Recent</h2>
          <div className="recent-row">
            {recents.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} onOpen={openProduct} />
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="browse-filters">
        <div className="filter-search">
          <input
            className="search-input"
            type="search"
            placeholder="Search templates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search templates"
          />
        </div>
        <div className="filter-chips" role="tablist" aria-label="Category">
          <button
            className={`filter-chip ${category === 'all' ? 'is-active' : ''}`}
            onClick={() => setCategory('all')}
          >
            All
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              className={`filter-chip ${category === c ? 'is-active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="filter-chips" role="tablist" aria-label="Audience">
          <button
            className={`filter-chip subtle ${audience === 'all' ? 'is-active' : ''}`}
            onClick={() => setAudience('all')}
          >
            Everyone
          </button>
          {AUDIENCES.map((a) => (
            <button
              key={a}
              className={`filter-chip subtle ${audience === a ? 'is-active' : ''}`}
              onClick={() => setAudience(a)}
            >
              {AUDIENCE_LABELS[a]}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button className="menu-text-btn inline" onClick={reset}>
            Show all
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="browse-empty">
          No templates match. <button className="linky" onClick={reset}>Show all</button>
        </p>
      ) : showAll ? (
        grouped.map((g) => (
          <section key={g.cat} className="browse-section">
            <h2 className="browse-section-title">{CATEGORY_LABELS[g.cat]}</h2>
            <div className="picker-grid">
              {g.items.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} onOpen={openProduct} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className="browse-section">
          <h2 className="browse-section-title">
            {category === 'all' ? 'Results' : CATEGORY_LABELS[category]}
            <span className="browse-count">{filtered.length}</span>
          </h2>
          <div className="picker-grid">
            {filtered.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} onOpen={openProduct} />
            ))}
          </div>
        </section>
      )}

      {/* Import a 3D model */}
      <button
        className="model-dropzone"
        onClick={() => modelRef.current?.click()}
        aria-label="Load a 3D model"
      >
        <span className="model-dropzone-emoji" aria-hidden>
          📦
        </span>
        <strong>Drop a 3D model here, or click to browse</strong>
        <span className="model-dropzone-sub">
          .glb, .gltf or .usdz — it loads straight into the configurator
        </span>
      </button>
      <input
        ref={modelRef}
        type="file"
        accept=".glb,.gltf,.usdz,.usda,.usdc,.usd,model/gltf-binary,model/gltf+json,model/vnd.usdz+zip"
        hidden
        onChange={onModelFile}
      />

      {/* Load from a remote URL (jsDelivr / GitHub / any HTTPS .glb) */}
      <div className="model-url-row">
        <input
          className="search-input model-url-input"
          type="url"
          inputMode="url"
          placeholder="…or paste a model URL (https://cdn.jsdelivr.net/gh/…/model.glb)"
          value={modelUrl}
          disabled={urlBusy}
          aria-label="Remote model URL"
          onChange={(e) => {
            setModelUrl(e.target.value)
            if (urlError) setUrlError('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && loadFromUrl()}
        />
        <button className="primary-btn" disabled={urlBusy || !modelUrl.trim()} onClick={loadFromUrl}>
          {urlBusy ? 'Loading…' : 'Load'}
        </button>
      </div>
      {urlError && <p className="model-url-error">{urlError}</p>}
      <p className="model-url-hint">
        GitHub links are auto-converted to the jsDelivr CDN. Update the file in
        your repo and reload — no rebuild needed.
      </p>

      <button className="ghost-btn center" onClick={() => fileRef.current?.click()}>
        Open a saved design…
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={onDesignFile}
      />

      <p className="picker-foot">
        Your work autosaves in this browser. Drop in any GLB/GLTF model and the
        editor generates its controls automatically.
      </p>
    </div>
  )
}
