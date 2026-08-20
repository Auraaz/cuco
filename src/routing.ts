import { useStudio } from './store'
import { productById } from './products/catalog'
import { readDraft } from './persistence'

/**
 * Lightweight hash routing: the URL reflects the open product
 * (`#/hoodie`), so it can be bookmarked, refreshed, and shared. On a
 * refresh into a product, the autosaved draft for that product is
 * restored so the full design comes back — not a blank garment.
 */
export function initRouting() {
  const hashProduct = () => location.hash.replace(/^#\/?/, '').split('?')[0]

  const openFromHash = (allowDraft: boolean) => {
    const id = hashProduct()
    const s = useStudio.getState()
    if (id && productById(id)) {
      if (s.productId === id) return
      const draft = allowDraft ? readDraft() : null
      if (draft && draft.productId === id) s.openDesign(draft)
      else s.openProduct(id)
    } else if (!id && s.productId) {
      s.closeProduct()
    }
  }

  /* Initial load — prefer the draft so a refresh restores the design. */
  openFromHash(true)

  /* Back/forward or manual hash edits — open fresh. */
  window.addEventListener('hashchange', () => openFromHash(false))

  /* Reflect store → URL. */
  useStudio.subscribe((state, prev) => {
    if (state.productId === prev.productId) return
    if (state.productId) {
      const want = `#/${state.productId}`
      if (location.hash !== want) location.hash = `/${state.productId}`
    } else if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search)
    }
  })
}
