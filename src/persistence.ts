import { useStudio } from './store'
import type { DesignConfig } from './types'

const DRAFT_KEY = 'apparel-studio:draft:v1'
const RECENTS_KEY = 'apparel-studio:recents:v1'

let dirty = false

/** Recently-opened product ids, most-recent first. */
export function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function pushRecent(id: string) {
  try {
    const next = [id, ...readRecents().filter((x) => x !== id)].slice(0, 8)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/** Read the autosaved working design, if any. */
export function readDraft(): DesignConfig | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as DesignConfig) : null
  } catch {
    return null
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
  dirty = false
}

/** Called after an explicit file save/export so the unload guard relaxes. */
export function markDesignSaved() {
  dirty = false
}

function writeDraft(cfg: DesignConfig) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(cfg))
  } catch {
    /* Over quota — retry a lighter copy without colorway thumbnails. */
    try {
      const light: DesignConfig = {
        ...cfg,
        colorways: (cfg.colorways ?? []).map((c) => ({ ...c, thumb: '' })),
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(light))
    } catch {
      /* give up silently */
    }
  }
}

/**
 * Continuously autosaves the working design to localStorage (debounced)
 * so a reload or Back-to-Products never loses work, and guards against
 * accidental tab close while there are unsaved changes.
 */
export function initPersistence() {
  let timer: number | undefined

  useStudio.subscribe((state, prev) => {
    const changed =
      state.productId !== prev.productId ||
      state.parts !== prev.parts ||
      state.layers !== prev.layers ||
      state.colorways !== prev.colorways ||
      state.variables !== prev.variables ||
      state.groups !== prev.groups ||
      state.permissions !== prev.permissions
    if (!changed) return

    /* Keep the last draft when returning to the picker so the user can
       resume — only stop autosaving (there's nothing active to save). */
    if (!state.productId) {
      dirty = false
      return
    }
    /* Skip imported models — their object URLs don't survive a reload, so
       a recents entry for one would be dead. */
    if (state.productId !== prev.productId && !state.productId.startsWith('custom-')) {
      pushRecent(state.productId)
    }
    dirty = true
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      const cfg = useStudio.getState().serializeDesign()
      if (cfg) writeDraft(cfg)
    }, 500)
  })

  window.addEventListener('beforeunload', (e) => {
    if (dirty && useStudio.getState().productId) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
}
