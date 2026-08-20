import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStudio } from '../store'
import { readCatalog, removeFromCatalog } from '../publish'
import { productById } from '../products/catalog'
import { BrandLockup } from './Brand'
import { RoleSwitch } from './RoleSwitch'
import { Cart } from './Icons'
import type { PublishedArticle } from '../types'

/** Number of consumer-editable controls / capabilities an article exposes. */
function editableCount(a: PublishedArticle): number {
  const vars = (a.config.variables ?? []).filter((v) => v.editable).length
  const perms = a.config.permissions ?? {}
  return (
    vars +
    (perms.changeColors ? 1 : 0) +
    (perms.addText ? 1 : 0) +
    (perms.addGraphic ? 1 : 0)
  )
}

/**
 * The consumer home — a gallery of published articles. Consumers can only
 * open and customize these (via the designer-exposed editable variables);
 * they cannot author from scratch.
 */
export function ConsumerCatalog() {
  const openArticle = useStudio((s) => s.openArticle)
  const setCartOpen = useStudio((s) => s.setCartOpen)
  const cartCount = useStudio((s) => s.cart.length)
  const [items, setItems] = useState<PublishedArticle[]>(() => readCatalog())
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((a) => a.name.toLowerCase().includes(q)) : items
  }, [items, query])

  return (
    <motion.main
      key="catalog"
      className="browse"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.header
        className="browse-head"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <BrandLockup variant="hero" />
        <p>Browse published articles and make them your own — change the options the designer opened up.</p>
        <div className="browse-role">
          <RoleSwitch />
          <button
            className="icon-btn lg cart-btn"
            aria-label={`Cart (${cartCount})`}
            title="Cart"
            onClick={() => setCartOpen(true)}
          >
            <Cart />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </motion.header>

      {items.length === 0 ? (
        <div className="catalog-empty">
          <span className="model-dropzone-emoji" aria-hidden>🧢</span>
          <strong>No published articles yet</strong>
          <p>
            Switch to <strong>Designer</strong> to create a customizable article
            and publish it — it'll show up here for consumers to personalize.
          </p>
        </div>
      ) : (
        <>
          <div className="browse-filters">
            <div className="filter-search">
              <input
                className="search-input"
                type="search"
                placeholder="Search catalog…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search catalog"
              />
            </div>
          </div>

          <section className="browse-section">
            <h2 className="browse-section-title">
              Catalog <span className="browse-count">{filtered.length}</span>
            </h2>
            <div className="picker-grid">
              {filtered.map((a, i) => {
                const product = productById(a.config.productId)
                const n = editableCount(a)
                return (
                  <motion.div
                    key={a.id}
                    className="article-card"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: 'easeOut' }}
                  >
                    <button
                      type="button"
                      className="article-open"
                      onClick={() => openArticle(a)}
                      aria-label={`Customize ${a.name}`}
                    >
                      {a.thumb ? (
                        <img className="article-thumb" src={a.thumb} alt="" loading="lazy" />
                      ) : (
                        <span className="article-thumb ph" aria-hidden>🧢</span>
                      )}
                      <span className="article-name">{a.name}</span>
                      <span className="article-meta">
                        {product?.name ?? 'Article'} ·{' '}
                        {n > 0 ? `${n} option${n === 1 ? '' : 's'}` : 'view only'}
                      </span>
                      <span className="product-cta">Customize</span>
                    </button>
                    <button
                      className="article-remove"
                      title="Remove from catalog"
                      aria-label={`Remove ${a.name} from catalog`}
                      onClick={() => setItems(removeFromCatalog(a.id))}
                    >
                      Remove
                    </button>
                  </motion.div>
                )
              })}
            </div>
          </section>
        </>
      )}

      <p className="picker-foot">
        This catalog is stored in your browser. Publish articles from Designer
        mode to add to it.
      </p>
    </motion.main>
  )
}
