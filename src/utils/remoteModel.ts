import { useGLTF } from '@react-three/drei'
import { useStudio } from '../store'
import { makeModelProduct } from '../products/catalog'
import {
  ModelError,
  fetchModel,
  isValidModel,
  nameFromUrl,
  validateModelUrl,
} from './modelUrl'

/**
 * Cache of downloaded models: original URL → object URL of the fetched
 * bytes. Re-requesting the same URL reuses the download. Bounded (LRU) so
 * repeated loads don't grow memory without limit; evicted entries free
 * their object URL and drop the parsed scene from the loader cache.
 */
const cache = new Map<string, string>()
const order: string[] = []
const CACHE_CAP = 5

function remember(url: string, blobUrl: string) {
  cache.set(url, blobUrl)
  order.push(url)
  while (order.length > CACHE_CAP) {
    const evict = order.shift()
    if (!evict || evict === url) continue
    const bu = cache.get(evict)
    if (bu) {
      try {
        useGLTF.clear(bu) /* drop the parsed scene / GPU resources */
      } catch {
        /* ignore */
      }
      URL.revokeObjectURL(bu)
    }
    cache.delete(evict)
  }
}

const TIMEOUT_MS = 45_000

export type RemoteResult = { ok: true } | { ok: false; reason: string }

/**
 * Validate, download (with progress), and open a remote GLB in the
 * configurator. Remote and local models share the same rendering pipeline
 * — the fetched bytes become an object URL that the normal GltfModel path
 * loads. Returns a friendly reason on failure instead of throwing.
 */
export async function openRemoteModel(input: string): Promise<RemoteResult> {
  const check = validateModelUrl(input)
  if (!check.ok) return check
  const url = check.url
  const format = check.format
  const store = useStudio.getState()

  /* Cache hit — reuse the already-downloaded bytes, no network. */
  const cached = cache.get(url)
  if (cached) {
    const def = makeModelProduct(cached, nameFromUrl(url), format)
    store.openProduct(def.id)
    return { ok: true }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  store.setLoadProgress({ ratio: null, label: 'Downloading model…' })
  try {
    const buf = await fetchModel(
      url,
      (ratio) => store.setLoadProgress({ ratio, label: 'Downloading model…' }),
      ctrl.signal,
    )
    clearTimeout(timer)

    if (!isValidModel(buf, format)) {
      store.setLoadProgress(null)
      return {
        ok: false,
        reason: `That file isn't a valid ${format === 'usdz' ? 'USDZ' : 'GLB'} (wrong or corrupted data).`,
      }
    }

    store.setLoadProgress({ ratio: 1, label: 'Preparing…' })
    const mime = format === 'usdz' ? 'model/vnd.usdz+zip' : 'model/gltf-binary'
    const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }))
    remember(url, blobUrl)
    const def = makeModelProduct(blobUrl, nameFromUrl(url), format)
    store.openProduct(def.id)
    store.setLoadProgress(null)
    return { ok: true }
  } catch (e) {
    clearTimeout(timer)
    store.setLoadProgress(null)
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, reason: 'Timed out downloading the model — the file may be too large or the host unreachable.' }
    }
    if (e instanceof ModelError) return { ok: false, reason: e.message }
    return {
      ok: false,
      reason:
        'Network or CORS error — the host must allow cross-origin requests. jsDelivr and GitHub raw do; some storage buckets need CORS enabled.',
    }
  }
}
