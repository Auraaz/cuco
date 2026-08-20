import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStudio } from '../store'
import { productById } from '../products/catalog'
import { readCatalog } from '../publish'
import { Close } from './Icons'

/**
 * Publish flow — the designer names the article and confirms which variables
 * consumers will be able to edit, then it's saved to the catalog.
 */
export function PublishDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const productId = useStudio((s) => s.productId)
  const variables = useStudio((s) => s.variables)
  const permissions = useStudio((s) => s.permissions)
  const setPermission = useStudio((s) => s.setPermission)
  const publishedArticleId = useStudio((s) => s.publishedArticleId)
  const publishArticle = useStudio((s) => s.publishArticle)
  const setVariantsOpen = useStudio((s) => s.setVariantsOpen)

  const product = productId ? productById(productId) : undefined
  const editable = useMemo(() => variables.filter((v) => v.editable), [variables])

  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)

  /* Seed the name from the product each time the dialog opens. */
  useEffect(() => {
    if (open) setName((n) => n || product?.name || 'My article')
  }, [open, product?.name])

  /* Will publishing update an existing catalog entry (vs create a new one)? */
  const isUpdate = useMemo(() => {
    if (!open || !productId) return false
    const catalog = readCatalog()
    const key = name.trim().toLowerCase()
    return catalog.some(
      (a) =>
        a.id === publishedArticleId ||
        (a.config.productId === productId && a.name.trim().toLowerCase() === key),
    )
  }, [open, productId, publishedArticleId, name])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const doPublish = async () => {
    if (busy || !name.trim()) return
    setBusy(true)
    try {
      await publishArticle(name, desc)
      onClose()
      setDesc('')
    } finally {
      setBusy(false)
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
            if (e.target === e.currentTarget && !busy) onClose()
          }}
        >
          <motion.div
            className="variants-modal publish-modal"
            role="dialog"
            aria-label="Publish article"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="variants-head">
              <div>
                <h2>{isUpdate ? 'Update article' : 'Publish to catalog'}</h2>
                <p>
                  {isUpdate
                    ? 'Save changes to the existing catalog article — consumers get the new version.'
                    : 'Make this design available to consumers as a customizable article.'}
                </p>
              </div>
              <button className="icon-btn lg" aria-label="Close" disabled={busy} onClick={onClose}>
                <Close />
              </button>
            </header>

            <div className="variants-body">
              <section className="variants-section">
                <label className="field">
                  <span className="field-label">Article name</span>
                  <input
                    className="search-input"
                    value={name}
                    autoFocus
                    placeholder="e.g. Classic Trucker Cap"
                    aria-label="Article name"
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doPublish()}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Short description (optional)</span>
                  <input
                    className="search-input"
                    value={desc}
                    placeholder="A line consumers see in the catalog"
                    aria-label="Description"
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </label>
              </section>

              <section className="variants-section">
                <h3 className="section-label">
                  Consumer-editable options <span className="browse-count">{editable.length}</span>
                </h3>
                {editable.length === 0 ? (
                  <p className="editor-empty small">
                    No individual options are marked editable yet. Mark a part
                    color, group, text, font, or artwork as{' '}
                    <strong>Consumer editable</strong> right where you edit it
                    (or in{' '}
                    <button className="linky" onClick={() => setVariantsOpen(true)}>
                      Auto Variants
                    </button>
                    ), and/or allow consumers to add their own text and graphics
                    below.
                  </p>
                ) : (
                  <div className="var-list">
                    {editable.map((v) => (
                      <div key={v.id} className="var-item">
                        <span className={`var-type-chip ${v.type}`}>{v.type}</span>
                        <span className="var-item-name">{v.name}</span>
                        <span className="var-item-target">{v.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="variants-section">
                <h3 className="section-label">Consumer can also</h3>
                <div className="perm-list">
                  <label className="perm-item">
                    <input
                      type="checkbox"
                      checked={!!permissions.changeColors}
                      onChange={(e) => setPermission('changeColors', e.target.checked)}
                    />
                    <span>
                      <strong>Change colors</strong>
                      <em>Consumers can recolor any part or group — no need to mark each one.</em>
                    </span>
                  </label>
                  <label className="perm-item">
                    <input
                      type="checkbox"
                      checked={!!permissions.addText}
                      onChange={(e) => setPermission('addText', e.target.checked)}
                    />
                    <span>
                      <strong>Add their own text</strong>
                      <em>Consumers can add and edit text layers (content, font, color).</em>
                    </span>
                  </label>
                  <label className="perm-item">
                    <input
                      type="checkbox"
                      checked={!!permissions.addGraphic}
                      onChange={(e) => setPermission('addGraphic', e.target.checked)}
                    />
                    <span>
                      <strong>Add their own graphics</strong>
                      <em>Consumers can upload and place their own artwork.</em>
                    </span>
                  </label>
                </div>
              </section>

              <div className="variants-actions">
                <button className="primary-btn" disabled={busy || !name.trim()} onClick={doPublish}>
                  {busy
                    ? isUpdate
                      ? 'Updating…'
                      : 'Publishing…'
                    : isUpdate
                      ? 'Update article'
                      : 'Publish article'}
                </button>
                <button className="primary-btn outline" disabled={busy} onClick={onClose}>
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
