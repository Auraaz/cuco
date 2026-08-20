import type { ProductDef, Zone } from '../types'
import {
  buildBaseballCap,
  buildBeanie,
  buildBucketHat,
  buildCap,
  buildHoodie,
  buildJoggers,
  buildPolo,
  buildShorts,
  buildSkirt,
  buildSweatshirt,
  buildTShirt,
} from './builders'

/* Placement zones. Positions are in each mesh's local (geometry) space. */

const SHIRT_ZONES: Zone[] = [
  { id: 'front-chest', label: 'Front Chest', mesh: 'Body', position: [0, 0.55, 0.98], rotation: [0, 0, 0], scale: 0.55 },
  { id: 'back', label: 'Back', mesh: 'Body', position: [0, 0.45, -0.98], rotation: [0, Math.PI, 0], scale: 0.7 },
  { id: 'sleeve-left', label: 'Sleeve Left', mesh: 'Sleeves', position: [-1.38, 0.52, 0], rotation: [0, -Math.PI / 2, 0], scale: 0.26 },
  { id: 'sleeve-right', label: 'Sleeve Right', mesh: 'Sleeves', position: [1.38, 0.52, 0], rotation: [0, Math.PI / 2, 0], scale: 0.26 },
]

const LONGSLEEVE_ZONES: Zone[] = [
  { id: 'front-chest', label: 'Front Chest', mesh: 'Body', position: [0, 0.55, 1.05], rotation: [0, 0, 0], scale: 0.55 },
  { id: 'back', label: 'Back', mesh: 'Body', position: [0, 0.45, -1.05], rotation: [0, Math.PI, 0], scale: 0.7 },
  { id: 'sleeve-left', label: 'Sleeve Left', mesh: 'Sleeves', position: [-1.5, 0.3, 0], rotation: [0, -Math.PI / 2, 0], scale: 0.24 },
  { id: 'sleeve-right', label: 'Sleeve Right', mesh: 'Sleeves', position: [1.5, 0.3, 0], rotation: [0, Math.PI / 2, 0], scale: 0.24 },
]

const HOODIE_ZONES: Zone[] = [
  { id: 'front-chest', label: 'Front Chest', mesh: 'Body', position: [0, 0.45, 1.06], rotation: [0, 0, 0], scale: 0.45 },
  { id: 'pocket', label: 'Pocket', mesh: 'Pocket', position: [0, -0.85, 1.12], rotation: [-0.06, 0, 0], scale: 0.3 },
  ...LONGSLEEVE_ZONES.filter((z) => z.id !== 'front-chest'),
]

const CAP_ZONES: Zone[] = [
  { id: 'cap-front', label: 'Cap Front', mesh: 'Crown', position: [0, 0.32, 0.78], rotation: [-0.35, 0, 0], scale: 0.42 },
  { id: 'cap-side-left', label: 'Side Left', mesh: 'Crown', position: [-0.78, 0.28, 0], rotation: [-0.3, -Math.PI / 2, 0], scale: 0.3 },
  { id: 'cap-side-right', label: 'Side Right', mesh: 'Crown', position: [0.78, 0.28, 0], rotation: [-0.3, Math.PI / 2, 0], scale: 0.3 },
  { id: 'cap-back', label: 'Cap Back', mesh: 'Crown', position: [0, 0.32, -0.78], rotation: [-0.35, Math.PI, 0], scale: 0.3 },
]

/* The baseball cap has a Front Panel sitting just outside the crown, so
   a front decal must target that panel or it hides behind it. */
const BASEBALL_ZONES: Zone[] = [
  { id: 'cap-front', label: 'Cap Front', mesh: 'Front Panel', position: [0, 0.34, 0.82], rotation: [-0.32, 0, 0], scale: 0.42 },
  { id: 'cap-side-left', label: 'Side Left', mesh: 'Crown', position: [-0.78, 0.28, 0], rotation: [-0.3, -Math.PI / 2, 0], scale: 0.3 },
  { id: 'cap-side-right', label: 'Side Right', mesh: 'Crown', position: [0.78, 0.28, 0], rotation: [-0.3, Math.PI / 2, 0], scale: 0.3 },
  { id: 'cap-back', label: 'Cap Back', mesh: 'Crown', position: [0, 0.32, -0.78], rotation: [-0.35, Math.PI, 0], scale: 0.3 },
]

const BUCKET_ZONES: Zone[] = [
  { id: 'front', label: 'Front', mesh: 'Crown', position: [0, 0.02, 0.78], rotation: [0, 0, 0], scale: 0.38 },
  { id: 'side-left', label: 'Side Left', mesh: 'Crown', position: [-0.78, 0.02, 0], rotation: [0, -Math.PI / 2, 0], scale: 0.3 },
  { id: 'side-right', label: 'Side Right', mesh: 'Crown', position: [0.78, 0.02, 0], rotation: [0, Math.PI / 2, 0], scale: 0.3 },
]

const BEANIE_ZONES: Zone[] = [
  { id: 'front', label: 'Front', mesh: 'Cuff', position: [0, -0.05, 0.88], rotation: [0, 0, 0], scale: 0.34 },
  { id: 'dome-front', label: 'Dome', mesh: 'Dome', position: [0, 0.45, 0.75], rotation: [-0.45, 0, 0], scale: 0.34 },
]

const LEGGED_ZONES: Zone[] = [
  { id: 'hip-front', label: 'Front', mesh: 'Hips', position: [0, 0.1, 0.85], rotation: [0, 0, 0], scale: 0.4 },
  { id: 'hip-back', label: 'Back', mesh: 'Hips', position: [0, 0.1, -0.85], rotation: [0, Math.PI, 0], scale: 0.4 },
  { id: 'leg-left', label: 'Left Leg', mesh: 'Left Leg', position: [-0.42, -0.9, 0.45], rotation: [0, 0, 0], scale: 0.28 },
  { id: 'leg-right', label: 'Right Leg', mesh: 'Right Leg', position: [0.42, -0.9, 0.45], rotation: [0, 0, 0], scale: 0.28 },
]

const SKIRT_ZONES: Zone[] = [
  { id: 'front', label: 'Front', mesh: 'Skirt', position: [0, -0.3, 1.05], rotation: [0.18, 0, 0], scale: 0.5 },
  { id: 'back', label: 'Back', mesh: 'Skirt', position: [0, -0.3, -1.05], rotation: [-0.18, Math.PI, 0], scale: 0.5 },
]

/* Placement zones for the imported GLB caps. Because `fit` normalizes the
   model to a centered ~2.7-unit space, these use the same convention as the
   procedural products. If a zone lands on the wrong face for a given model,
   "Position by dragging on model" repositions it anywhere on the surface. */
const IMPORT_CAP_ZONES: Zone[] = [
  { id: 'front', label: 'Front', mesh: 'baseballCap', position: [0, 0.15, 1.05], rotation: [0, 0, 0], scale: 0.5 },
  { id: 'back', label: 'Back', mesh: 'baseballCap', position: [0, 0.15, -1.05], rotation: [0, Math.PI, 0], scale: 0.5 },
  { id: 'side-left', label: 'Side Left', mesh: 'baseballCap', position: [-1.05, 0.15, 0], rotation: [0, -Math.PI / 2, 0], scale: 0.4 },
  { id: 'side-right', label: 'Side Right', mesh: 'baseballCap', position: [1.05, 0.15, 0], rotation: [0, Math.PI / 2, 0], scale: 0.4 },
]
const IMPORT_CAP2_ZONES: Zone[] = [
  { id: 'front', label: 'Front', mesh: 'Cap__0', position: [0, 0.15, 1.05], rotation: [0, 0, 0], scale: 0.5 },
  { id: 'back', label: 'Back', mesh: 'Cap__0', position: [0, 0.15, -1.05], rotation: [0, Math.PI, 0], scale: 0.5 },
]

/**
 * Product catalog. Placeholder models are built procedurally; a future
 * product can instead supply `url` pointing at a GLTF/GLB file and the
 * rest of the app works unchanged — the UI is generated by traversing
 * whatever hierarchy the loader produces.
 */
const GLTF_BASE = import.meta.env.BASE_URL

const ALL: import('../types').Audience[] = ['men', 'women', 'kids']

export const PRODUCTS: ProductDef[] = [
  // Tops
  { id: 't-shirt', name: 'T Shirt', glyph: '👕', tint: '#EEF2FF', build: buildTShirt, zones: SHIRT_ZONES, category: 'tops', audiences: ALL },
  {
    id: 'tee-gltf',
    name: 'Tee (GLTF)',
    glyph: '👕',
    tint: '#F0F9FF',
    url: `${GLTF_BASE}models/tee.glb`,
    zones: SHIRT_ZONES,
    category: 'tops',
    audiences: ALL,
  },
  { id: 'polo', name: 'Polo', glyph: '👔', tint: '#EFF6FF', build: buildPolo, zones: SHIRT_ZONES, category: 'tops', audiences: ['men', 'women'] },
  { id: 'hoodie', name: 'Hoodie', glyph: '🧥', tint: '#F4F4F5', build: buildHoodie, zones: HOODIE_ZONES, category: 'tops', audiences: ALL },
  { id: 'sweatshirt', name: 'Sweatshirt', glyph: '🧶', tint: '#F5F3FF', build: buildSweatshirt, zones: LONGSLEEVE_ZONES, category: 'tops', audiences: ALL },

  // Bottoms
  { id: 'shorts', name: 'Shorts', glyph: '🩳', tint: '#EFF6FF', build: buildShorts, zones: LEGGED_ZONES, category: 'bottoms', audiences: ALL },
  { id: 'joggers', name: 'Joggers', glyph: '👖', tint: '#F4F4F5', build: buildJoggers, zones: LEGGED_ZONES, category: 'bottoms', audiences: ALL },
  { id: 'skirt', name: 'Skirt', glyph: '👗', tint: '#FDF2F8', build: buildSkirt, zones: SKIRT_ZONES, category: 'bottoms', audiences: ['women', 'kids'] },

  // Accessories
  { id: 'cap', name: 'Cap', glyph: '🧢', tint: '#F0FDF4', build: buildCap, zones: CAP_ZONES, category: 'accessories', audiences: ALL },
  { id: 'baseball-cap', name: 'Baseball Cap', glyph: '⚾', tint: '#FEF2F2', build: buildBaseballCap, zones: BASEBALL_ZONES, category: 'accessories', audiences: ALL },
  { id: 'bucket-hat', name: 'Bucket Hat', glyph: '👒', tint: '#FEFCE8', build: buildBucketHat, zones: BUCKET_ZONES, category: 'accessories', audiences: ALL },
  { id: 'beanie', name: 'Beanie', glyph: '❄️', tint: '#F0FDFA', build: buildBeanie, zones: BEANIE_ZONES, category: 'accessories', audiences: ALL },

  // Imported 3D models (GLB) — real scanned/authored geometry
  {
    id: 'baseball-cap-glb',
    name: 'Ball Cap (3D)',
    glyph: '🧢',
    tint: '#ECFEFF',
    url: `${GLTF_BASE}models/baseball_cap.glb`,
    fit: true,
    zones: IMPORT_CAP_ZONES,
    category: 'accessories',
    audiences: ALL,
  },
  {
    id: 'cap-glb',
    name: 'Cap (3D)',
    glyph: '🧢',
    tint: '#F0FDFA',
    url: `${GLTF_BASE}models/cap_5mb.glb`,
    fit: true,
    zones: IMPORT_CAP2_ZONES,
    category: 'accessories',
    audiences: ALL,
  },
]

/* Ad-hoc products created at runtime from a dropped/opened GLB. Kept in a
   separate registry (not the static catalog) and resolved by productById. */
const customProducts = new Map<string, ProductDef>()

export function registerCustomProduct(def: ProductDef) {
  customProducts.set(def.id, def)
}

export const productById = (id: string): ProductDef | undefined =>
  PRODUCTS.find((p) => p.id === id) ?? customProducts.get(id)

/**
 * Generic placement zones for an imported model of unknown geometry. The
 * empty `mesh` is resolved at runtime to the model's primary (largest)
 * mesh; positions are in the normalized, fitted coordinate space, so they
 * land near each face. Drag-on-model repositions anywhere.
 */
export const GENERIC_ZONES: Zone[] = [
  { id: 'front', label: 'Front', mesh: '', position: [0, 0.1, 1.15], rotation: [0, 0, 0], scale: 0.5 },
  { id: 'back', label: 'Back', mesh: '', position: [0, 0.1, -1.15], rotation: [0, Math.PI, 0], scale: 0.5 },
  { id: 'left', label: 'Left', mesh: '', position: [-1.15, 0.1, 0], rotation: [0, -Math.PI / 2, 0], scale: 0.45 },
  { id: 'right', label: 'Right', mesh: '', position: [1.15, 0.1, 0], rotation: [0, Math.PI / 2, 0], scale: 0.45 },
  { id: 'top', label: 'Top', mesh: '', position: [0, 1.2, 0], rotation: [-Math.PI / 2, 0, 0], scale: 0.45 },
]

let customSeq = 1

/**
 * Build (and register) an imported-model product from any model URL — an
 * object URL (dropped file / fetched remote), a CDN URL, or a local path.
 * `fit` normalizes arbitrary scale/orientation so it drops straight into
 * the configurator, sharing the exact rendering pipeline as the built-ins.
 */
export function makeModelProduct(
  url: string,
  name: string,
  format: 'gltf' | 'usdz' = 'gltf',
): ProductDef {
  const def: ProductDef = {
    id: `custom-${customSeq++}`,
    name: name || 'Imported model',
    glyph: '📦',
    tint: '#EEF2FF',
    url,
    format,
    fit: true,
    zones: GENERIC_ZONES,
    category: 'accessories',
    audiences: ALL,
  }
  registerCustomProduct(def)
  return def
}

/** Build a product from a dropped/selected model file (GLB/GLTF/USDZ). */
export function loadCustomGlb(file: File): ProductDef {
  const url = URL.createObjectURL(file)
  const name = file.name.replace(/\.(glb|gltf|usdz|usda|usdc|usd)$/i, '').replace(/[_-]+/g, ' ').trim()
  const format: 'gltf' | 'usdz' = /\.(usdz|usda|usdc|usd)$/i.test(file.name) ? 'usdz' : 'gltf'
  return makeModelProduct(url, name, format)
}

export const CATEGORY_LABELS: Record<import('../types').ProductCategory, string> = {
  tops: 'Tops',
  bottoms: 'Bottoms',
  accessories: 'Accessories',
}

export const AUDIENCE_LABELS: Record<import('../types').Audience, string> = {
  men: 'Men',
  women: 'Women',
  kids: 'Kids',
}
