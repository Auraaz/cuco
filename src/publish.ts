/**
 * Role + published-article catalog persistence.
 *
 * There is no backend, so a designer "publishes" an article by saving its
 * full DesignConfig (with a hero thumbnail) to localStorage. Consumers read
 * the same catalog to browse and customize. The active role is likewise a
 * local preference toggled in-app.
 */
import type { PublishedArticle, Role } from './types'

const ROLE_KEY = 'apparel-studio:role:v1'
const CATALOG_KEY = 'apparel-studio:catalog:v1'

/** Most-recent-first cap so localStorage can't grow without bound. */
const CATALOG_LIMIT = 60

/* ------------------------------------------------------------------ */
/* Role                                                                */
/* ------------------------------------------------------------------ */

/** Read the saved role, defaulting to designer (the authoring experience). */
export function readRole(): Role {
  try {
    return localStorage.getItem(ROLE_KEY) === 'consumer' ? 'consumer' : 'designer'
  } catch {
    return 'designer'
  }
}

export function writeRole(role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

/** All published articles, most-recent first. */
export function readCatalog(): PublishedArticle[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY)
    const list = raw ? (JSON.parse(raw) as PublishedArticle[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeCatalog(list: PublishedArticle[]) {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(list))
  } catch {
    /* Over quota — retry a lighter copy without hero thumbnails. */
    try {
      localStorage.setItem(
        CATALOG_KEY,
        JSON.stringify(list.map((a) => ({ ...a, thumb: '' }))),
      )
    } catch {
      /* give up silently */
    }
  }
}

/** Publish (or re-publish) an article, prepending it to the catalog. */
export function publishToCatalog(article: PublishedArticle): PublishedArticle[] {
  const next = [article, ...readCatalog().filter((a) => a.id !== article.id)].slice(
    0,
    CATALOG_LIMIT,
  )
  writeCatalog(next)
  return next
}

/** Remove an article from the catalog. */
export function removeFromCatalog(id: string): PublishedArticle[] {
  const next = readCatalog().filter((a) => a.id !== id)
  writeCatalog(next)
  return next
}

/** Look up a single published article by id. */
export function articleById(id: string): PublishedArticle | undefined {
  return readCatalog().find((a) => a.id === id)
}
