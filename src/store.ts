import { create } from 'zustand'
import * as THREE from 'three'
import { presetById } from './materials/presets'
import { renderPattern } from './materials/patterns'
import { productById } from './products/catalog'
import { renderText } from './utils/textRender'
import {
  applyVariant,
  designConfigFor,
  sameTarget,
  settleFrames,
  slugify,
  toCsv,
  type GraphicResolver,
  type VariantRow,
} from './utils/variants'
import { createZip, dataUrlToBytes, type ZipEntry } from './utils/zip'
import { publishToCatalog, readCatalog, readRole, writeRole } from './publish'
import { addToCartStore, ITEM_PRICE, readCart, removeFromCart as removeCartItem, clearCart as clearCartStore } from './cart'
import { TEXT_FONTS } from './utils/textRender'
import type {
  CameraPresetId,
  CartItem,
  Colorway,
  ConsumerPermissions,
  DecalLayer,
  DesignConfig,
  DesignVariable,
  ExportOptions,
  MaterialPresetId,
  PartGroup,
  PartState,
  PartTexture,
  PatternId,
  PublishedArticle,
  Role,
  TextSpec,
  VariableTarget,
  VariableType,
} from './types'

/** Turn a mesh name like "front_panel" or "FrontPanel" into "Front Panel". */
export function prettifyName(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export const CURATED_COLORS = [
  '#FFFFFF', '#F4F4F5', '#D4D4D8', '#71717A', '#3F3F46', '#18181B',
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#10B981',
  '#06B6D4', '#3B82F6', '#1F3A5F', '#6366F1', '#A855F7', '#EC4899',
]

/* ------------------------------------------------------------------ */
/* History                                                            */
/* ------------------------------------------------------------------ */

interface Snapshot {
  parts: PartState[]
  layers: DecalLayer[]
}

let past: Snapshot[] = []
let future: Snapshot[] = []
let lastKey = ''
let lastTime = 0
const HISTORY_LIMIT = 100
const COALESCE_MS = 700

const cloneSnap = (s: Snapshot): Snapshot => ({
  parts: s.parts.map((p) => ({ ...p })),
  layers: s.layers.map((l) => ({ ...l, position: [...l.position] as DecalLayer['position'], rotation: [...l.rotation] as DecalLayer['rotation'] })),
})

let layerSeq = 1
let colorwaySeq = 1
let varSeq = 1
let groupSeq = 1
let articleSeq = 1
let cartSeq = 1

/** Highlight set for a part: the whole group it belongs to, else itself. */
const highlightForPart = (id: string | null, groups: PartGroup[]): string[] => {
  const g = id ? groups.find((gr) => gr.partIds.includes(id)) : undefined
  return g ? [...g.partIds] : id ? [id] : []
}

const cloneParts = (parts: PartState[]) => parts.map((p) => ({ ...p }))
const cloneLayers = (layers: DecalLayer[]) =>
  layers.map((l) => ({
    ...l,
    position: [...l.position] as DecalLayer['position'],
    rotation: [...l.rotation] as DecalLayer['rotation'],
  }))

export interface StudioState {
  /** Active experience. Designers author; consumers browse & customize. */
  role: Role
  /** The published article a consumer is currently customizing, if any. */
  activeArticle: PublishedArticle | null
  productId: string | null
  parts: PartState[]
  layers: DecalLayer[]
  /** Largest mesh in the current model — the default decal target for
   *  imported models whose zones don't name a real mesh. */
  primaryMesh: string | null
  colorways: Colorway[]
  variables: DesignVariable[]
  /** Designer-defined part bundles (multi-select → "group as one"). */
  groups: PartGroup[]
  /** Part ids currently multi-selected for grouping (designer only). */
  selectedPartIds: string[]
  /** Part ids to highlight (glow) in the 3D viewport — follows the current
   *  selection in either role. */
  highlightPartIds: string[]
  /** What consumers may do with the published article (add text/graphics). */
  permissions: ConsumerPermissions
  /** Catalog id this design was last published under (for re-publish). */
  publishedArticleId: string | null
  /** Consumer shopping cart (customized-article snapshots). */
  cart: CartItem[]
  cartOpen: boolean
  variantsOpen: boolean
  /** Progress while generating/exporting variants, else null. */
  variantProgress: { phase: 'generate' | 'export'; done: number; total: number } | null
  /** Progress while downloading a remote model, else null. ratio null = indeterminate. */
  loadProgress: { ratio: number | null; label: string } | null
  techPackOpen: boolean
  toastMsg: string | null
  selectedPartId: string | null
  selectedLayerId: string | null
  /** Which selection the properties panel shows. */
  activePanel: 'part' | 'layer'
  /** When true, dragging on the model repositions the selected layer. */
  placing: boolean
  cameraPreset: CameraPresetId | null
  cameraNonce: number
  /** Custom focus target (double-click a part); consumed by CameraRig. */
  cameraFocus: { target: [number, number, number]; nonce: number } | null
  autoRotate: boolean
  sheetOpen: boolean
  sheetTab: 'parts' | 'graphics'
  recentColors: string[]
  exporting: boolean
  canUndo: boolean
  canRedo: boolean
  exportFn: ((opts: ExportOptions) => Promise<void>) | null
  exportHeroFn: ((opts: ExportOptions) => Promise<void>) | null
  /** Renders a consistent hero-view thumbnail; used for colorways. */
  captureFn: ((size: number) => Promise<string>) | null
  /** Set when opening a saved design; consumed by initParts. */
  pendingRestore: DesignConfig | null

  openProduct: (id: string) => void
  openDesign: (config: DesignConfig) => void
  closeProduct: () => void
  initParts: (parts: PartState[]) => void
  setPrimaryMesh: (name: string | null) => void
  selectPart: (id: string | null) => void
  selectLayer: (id: string | null) => void
  updatePart: (id: string, patch: Partial<PartState>) => void
  applyPreset: (id: string, preset: MaterialPresetId) => void
  applyPattern: (id: string, patternId: PatternId) => void
  setPartTexture: (id: string, texture: PartTexture | null) => void
  updatePartTexture: (id: string, patch: Partial<PartTexture>) => void
  resetParts: () => void

  addLayer: (image: string, name: string, aspect?: number, source?: DecalLayer['source']) => void
  addTextLayer: (spec: TextSpec, source?: DecalLayer['source']) => void
  updateTextLayer: (id: string, spec: TextSpec) => void
  updateLayer: (id: string, patch: Partial<DecalLayer>) => void
  snapLayerToZone: (id: string, zoneId: string) => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  moveLayer: (id: string, dir: -1 | 1) => void
  /** Nudge a layer along its surface frame (dx right, dy up). */
  nudgeLayer: (id: string, dx: number, dy: number) => void
  setPlacing: (v: boolean) => void

  addColorway: () => Promise<void>
  applyColorway: (id: string) => void
  removeColorway: (id: string) => void
  renameColorway: (id: string, name: string) => void
  clearGeneratedColorways: () => void
  setTechPackOpen: (v: boolean) => void
  toast: (msg: string) => void

  /* Auto-variant feature */
  addVariable: (
    type: VariableType,
    target: VariableTarget,
    label: string,
    name: string,
  ) => void
  removeVariable: (id: string) => void
  removeVariableForTarget: (target: VariableTarget) => void
  renameVariable: (id: string, name: string) => void
  /** Toggle whether a variable is exposed to consumers. */
  setVariableEditable: (id: string, editable: boolean) => void
  setVariantsOpen: (v: boolean) => void

  /* Roles, grouping & publishing */
  setRole: (role: Role) => void
  /** Toggle a part in the multi-select set used for grouping. */
  togglePartInSelection: (id: string) => void
  clearPartSelection: () => void
  /** Set which parts glow in the viewport (used by the consumer outliner). */
  setHighlight: (ids: string[]) => void
  /** Bundle the multi-selected parts into a group + an editable group-color
   *  variable, so consumers get one control for several meshes. */
  createGroupFromSelection: () => void
  removeGroup: (id: string) => void
  renameGroup: (id: string, name: string) => void
  /** Set the color of every part in a group at once. */
  setGroupColor: (groupId: string, color: string) => void
  /** Toggle a consumer capability (add text / add graphics). */
  setPermission: (key: keyof ConsumerPermissions, value: boolean) => void
  /** Consumer: add a personal text layer (allowed only when permitted). */
  consumerAddText: () => void
  /** Consumer: add a personal artwork layer (allowed only when permitted). */
  consumerAddGraphic: (image: string, name: string, aspect?: number) => void
  /** Open a published article for consumer customization. */
  openArticle: (article: PublishedArticle) => void
  /** Publish the current design to the local catalog. Returns the article. */
  publishArticle: (name: string, description?: string) => Promise<PublishedArticle | null>
  /** Consumer: add the current customization to the cart. */
  addToCart: () => Promise<void>
  removeFromCart: (id: string) => void
  clearCart: () => void
  setCartOpen: (v: boolean) => void
  setLoadProgress: (p: { ratio: number | null; label: string } | null) => void
  /** Apply each spreadsheet row to the base design and store the results as colorways. */
  generateVariants: (rows: VariantRow[], resolver: GraphicResolver) => Promise<number>
  /** Re-render the given colorways at higher resolution and return a ZIP pack. */
  exportVariantPack: (ids: string[]) => Promise<Blob | null>

  undo: () => void
  redo: () => void

  setCameraPreset: (id: CameraPresetId | null) => void
  focusOn: (target: [number, number, number]) => void
  setAutoRotate: (v: boolean) => void
  setSheetOpen: (v: boolean) => void
  setSheetTab: (t: 'parts' | 'graphics') => void
  pushRecentColor: (c: string) => void
  setExportFn: (fn: StudioState['exportFn']) => void
  setExportHeroFn: (fn: StudioState['exportHeroFn']) => void
  setCaptureFn: (fn: StudioState['captureFn']) => void
  setExporting: (v: boolean) => void

  serializeDesign: () => DesignConfig | null
}

/** Map a placement zone to the camera preset that best shows it. */
function cameraPresetForZone(zoneId: string): CameraPresetId | null {
  if (zoneId.includes('back')) return 'back'
  if (zoneId.includes('left')) return 'left'
  if (zoneId.includes('right')) return 'right'
  if (
    zoneId.includes('front') ||
    zoneId.includes('chest') ||
    zoneId.includes('pocket') ||
    zoneId.includes('dome')
  )
    return 'front'
  return null
}

/** Pristine copy of each product's initial part states, for Reset. */
const initialParts = new Map<string, PartState[]>()

export const useStudio = create<StudioState>()((set, get) => {
  /** Push current state to history (with slider-drag coalescing). */
  const commit = (key: string) => {
    const now = Date.now()
    if (key === lastKey && now - lastTime < COALESCE_MS) {
      lastTime = now
      return
    }
    const { parts, layers } = get()
    past.push(cloneSnap({ parts, layers }))
    if (past.length > HISTORY_LIMIT) past.shift()
    future = []
    lastKey = key
    lastTime = now
    set({ canUndo: true, canRedo: false })
  }

  const clearHistory = () => {
    past = []
    future = []
    lastKey = ''
    set({ canUndo: false, canRedo: false })
  }

  /** Resolve a zone's mesh name to one that actually exists in the model —
   *  falling back to the primary (largest) mesh, then the first part. This
   *  lets generic zones drive decals on imported models of unknown mesh
   *  naming. */
  const resolveMeshName = (want?: string): string => {
    const { parts, primaryMesh } = get()
    if (want && parts.some((p) => p.meshName === want)) return want
    if (primaryMesh && parts.some((p) => p.meshName === primaryMesh)) return primaryMesh
    return parts[0]?.meshName ?? want ?? ''
  }

  return {
    role: readRole(),
    activeArticle: null,
    productId: null,
    parts: [],
    layers: [],
    primaryMesh: null,
    colorways: [],
    variables: [],
    groups: [],
    selectedPartIds: [],
    highlightPartIds: [],
    permissions: {},
    publishedArticleId: null,
    cart: readCart(),
    cartOpen: false,
    variantsOpen: false,
    variantProgress: null,
    loadProgress: null,
    techPackOpen: false,
    toastMsg: null,
    selectedPartId: null,
    selectedLayerId: null,
    activePanel: 'part',
    placing: false,
    cameraPreset: 'perspective',
    cameraNonce: 0,
    cameraFocus: null,
    autoRotate: false,
    sheetOpen: false,
    sheetTab: 'parts',
    recentColors: [],
    exporting: false,
    canUndo: false,
    canRedo: false,
    exportFn: null,
    exportHeroFn: null,
    captureFn: null,
    pendingRestore: null,

    openProduct: (id) => {
      clearHistory()
      set({
        activeArticle: null,
        productId: id,
        parts: [],
        layers: [],
        primaryMesh: null,
        colorways: [],
        variables: [],
        groups: [],
        selectedPartIds: [],
        highlightPartIds: [],
        permissions: {},
        publishedArticleId: null,
        variantsOpen: false,
        variantProgress: null,
        techPackOpen: false,
        selectedPartId: null,
        selectedLayerId: null,
        activePanel: 'part',
        placing: false,
        pendingRestore: null,
        cameraPreset: 'perspective',
        cameraNonce: get().cameraNonce + 1,
        sheetOpen: false,
        sheetTab: 'parts',
      })
    },

    openDesign: (config) => {
      get().openProduct(config.productId)
      set({ pendingRestore: config })
    },

    openArticle: (article) => {
      get().openProduct(article.config.productId)
      set({ pendingRestore: article.config, activeArticle: article })
    },

    setPermission: (key, value) =>
      set((s) => ({ permissions: { ...s.permissions, [key]: value } })),

    consumerAddText: () => {
      if (!get().permissions.addText) return
      get().addTextLayer(
        { content: 'Your text', font: 'sans', weight: 800, color: '#18181B' },
        'consumer',
      )
    },

    consumerAddGraphic: (image, name, aspect = 1) => {
      if (!get().permissions.addGraphic) return
      get().addLayer(image, name, aspect, 'consumer')
    },

    closeProduct: () => {
      clearHistory()
      set({
        activeArticle: null,
        productId: null,
        parts: [],
        layers: [],
        primaryMesh: null,
        colorways: [],
        variables: [],
        groups: [],
        selectedPartIds: [],
        highlightPartIds: [],
        permissions: {},
        publishedArticleId: null,
        variantsOpen: false,
        variantProgress: null,
        techPackOpen: false,
        selectedPartId: null,
        selectedLayerId: null,
        placing: false,
      })
    },

    initParts: (parts) => {
      const { productId, pendingRestore } = get()
      if (productId && !initialParts.has(productId)) {
        initialParts.set(productId, parts.map((p) => ({ ...p })))
      }
      if (pendingRestore && pendingRestore.productId === productId) {
        /* Restore saved design: prefer saved part state, keep generated
           entries for meshes the saved file doesn't know about. */
        const saved = new Map(pendingRestore.parts.map((p) => [p.id, p]))
        const merged = parts.map((p) => saved.get(p.id) ?? p)
        layerSeq =
          pendingRestore.layers.reduce(
            (m, l) => Math.max(m, Number(l.id.split(':')[1] ?? 0)),
            0,
          ) + 1
        const colorways = pendingRestore.colorways ?? []
        colorwaySeq =
          colorways.reduce(
            (m, c) => Math.max(m, Number(c.id.split(':')[1] ?? 0)),
            0,
          ) + 1
        const variables = pendingRestore.variables ?? []
        varSeq =
          variables.reduce(
            (m, v) => Math.max(m, Number(v.id.split(':')[1] ?? 0)),
            0,
          ) + 1
        const groups = pendingRestore.groups ?? []
        groupSeq =
          groups.reduce(
            (m, g) => Math.max(m, Number(g.id.split(':')[1] ?? 0)),
            0,
          ) + 1
        set({
          parts: merged,
          layers: pendingRestore.layers.map((l) => ({ ...l, aspect: l.aspect ?? 1 })),
          colorways,
          variables,
          groups,
          permissions: pendingRestore.permissions ?? {},
          publishedArticleId: pendingRestore.publishedId ?? null,
          selectedPartIds: [],
          selectedPartId: merged[0]?.id ?? null,
          highlightPartIds: highlightForPart(merged[0]?.id ?? null, groups),
          pendingRestore: null,
        })
        return
      }
      set({
        parts,
        groups: [],
        selectedPartIds: [],
        selectedPartId: parts[0]?.id ?? null,
        highlightPartIds: parts[0]?.id ? [parts[0].id] : [],
      })
    },

    setPrimaryMesh: (name) => set({ primaryMesh: name }),

    selectPart: (id) =>
      set((s) => {
        /* Unified selection for both roles: selecting a part that belongs to
           a group highlights the whole group (groups "display as one"), else
           just the part. */
        const group = id ? s.groups.find((g) => g.partIds.includes(id)) : undefined
        return {
          selectedPartId: id,
          selectedPartIds: [],
          highlightPartIds: group ? [...group.partIds] : id ? [id] : [],
          activePanel: 'part',
          placing: false,
        }
      }),

    selectLayer: (id) =>
      set({ selectedLayerId: id, activePanel: id ? 'layer' : 'part' }),

    updatePart: (id, patch) => {
      commit(`part:${id}:${Object.keys(patch).join(',')}`)
      set((s) => ({
        parts: s.parts.map((p) => {
          if (p.id !== id) return p
          const next = { ...p, ...patch }
          /* Recolor an active procedural pattern when the base color
             changes so the Color control stays meaningful. */
          if (patch.color != null && next.texture?.patternId) {
            next.texture = {
              ...next.texture,
              src: renderPattern(next.texture.patternId, patch.color),
            }
          }
          return next
        }),
      }))
    },

    applyPreset: (id, presetId) => {
      const preset = presetById(presetId)
      get().updatePart(id, {
        preset: presetId,
        roughness: preset.roughness,
        metalness: preset.metalness,
      })
    },

    applyPattern: (id, patternId) => {
      const part = get().parts.find((p) => p.id === id)
      if (!part) return
      get().updatePart(id, {
        texture: { src: renderPattern(patternId, part.color), scale: 4, rotation: 0, patternId },
      })
    },

    setPartTexture: (id, texture) => {
      get().updatePart(id, { texture: texture ?? undefined })
    },

    updatePartTexture: (id, patch) => {
      const part = get().parts.find((p) => p.id === id)
      if (!part?.texture) return
      get().updatePart(id, { texture: { ...part.texture, ...patch } })
    },

    resetParts: () => {
      const { productId } = get()
      const pristine = productId ? initialParts.get(productId) : undefined
      if (!pristine) return
      commit('reset')
      set({ parts: pristine.map((p) => ({ ...p })), layers: [] })
    },

    addLayer: (image, name, aspect = 1, source) => {
      const { productId, layers } = get()
      const product = productId ? productById(productId) : undefined
      if (!product) return
      const zone = product.zones[0]
      commit(`layer:add:${layerSeq}`)
      const layer: DecalLayer = {
        id: `layer:${layerSeq++}`,
        name,
        image,
        mesh: resolveMeshName(zone?.mesh),
        zoneId: zone?.id ?? null,
        position: zone ? [...zone.position] : [0, 0.1, 1.1],
        rotation: zone ? [...zone.rotation] : [0, 0, 0],
        spin: 0,
        scale: zone?.scale ?? 0.5,
        aspect,
        opacity: 1,
        flipX: false,
        visible: true,
        source,
      }
      set({
        layers: [...layers, layer],
        selectedLayerId: layer.id,
        activePanel: 'layer',
        sheetTab: 'graphics',
      })
    },

    addTextLayer: (spec, source) => {
      const { productId, layers } = get()
      const product = productId ? productById(productId) : undefined
      if (!product) return
      const zone = product.zones[0]
      const { dataUrl, aspect } = renderText(spec)
      commit(`layer:add:${layerSeq}`)
      const layer: DecalLayer = {
        id: `layer:${layerSeq++}`,
        name: spec.content.split('\n')[0].slice(0, 24) || 'Text',
        image: dataUrl,
        text: { ...spec },
        mesh: resolveMeshName(zone?.mesh),
        zoneId: zone?.id ?? null,
        position: zone ? [...zone.position] : [0, 0.1, 1.1],
        rotation: zone ? [...zone.rotation] : [0, 0, 0],
        spin: 0,
        scale: zone?.scale ?? 0.5,
        aspect,
        opacity: 1,
        flipX: false,
        visible: true,
        source,
      }
      set({
        layers: [...layers, layer],
        selectedLayerId: layer.id,
        activePanel: 'layer',
        sheetTab: 'graphics',
      })
    },

    updateTextLayer: (id, spec) => {
      const { dataUrl, aspect } = renderText(spec)
      get().updateLayer(id, {
        image: dataUrl,
        aspect,
        text: { ...spec },
        name: spec.content.split('\n')[0].slice(0, 24) || 'Text',
      })
    },

    updateLayer: (id, patch) => {
      commit(`layer:${id}:${Object.keys(patch).join(',')}`)
      set((s) => ({
        layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }))
    },

    snapLayerToZone: (id, zoneId) => {
      const { productId } = get()
      const product = productId ? productById(productId) : undefined
      const zone = product?.zones.find((z) => z.id === zoneId)
      if (!zone) return
      get().updateLayer(id, {
        zoneId,
        mesh: resolveMeshName(zone.mesh),
        position: [...zone.position],
        rotation: [...zone.rotation],
        scale: zone.scale,
      })
      /* Auto-frame: turn the camera to whichever side the zone is on so
         the artwork the user just placed is actually visible. */
      const preset = cameraPresetForZone(zoneId)
      if (preset) get().setCameraPreset(preset)
    },

    removeLayer: (id) => {
      commit(`layer:remove:${id}`)
      set((s) => ({
        layers: s.layers.filter((l) => l.id !== id),
        /* Drop any variables bound to the layer that's going away. */
        variables: s.variables.filter(
          (v) => !('layerId' in v.target && v.target.layerId === id),
        ),
        selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
        activePanel: s.selectedLayerId === id ? 'part' : s.activePanel,
        placing: s.selectedLayerId === id ? false : s.placing,
      }))
    },

    duplicateLayer: (id) => {
      const src = get().layers.find((l) => l.id === id)
      if (!src) return
      commit(`layer:dup:${id}`)
      const copy: DecalLayer = {
        ...src,
        id: `layer:${layerSeq++}`,
        name: `${src.name} copy`,
        position: [src.position[0] + 0.12, src.position[1] - 0.12, src.position[2]],
        zoneId: null,
      }
      set((s) => ({ layers: [...s.layers, copy], selectedLayerId: copy.id }))
    },

    moveLayer: (id, dir) => {
      const { layers } = get()
      const i = layers.findIndex((l) => l.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= layers.length) return
      commit(`layer:order:${id}:${dir}`)
      const next = [...layers]
      ;[next[i], next[j]] = [next[j], next[i]]
      set({ layers: next })
    },

    nudgeLayer: (id, dx, dy) => {
      const layer = get().layers.find((l) => l.id === id)
      if (!layer) return
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...layer.rotation),
      )
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
      const pos = new THREE.Vector3(...layer.position)
        .addScaledVector(right, dx)
        .addScaledVector(up, dy)
      get().updateLayer(id, {
        position: [pos.x, pos.y, pos.z],
        zoneId: null,
      })
    },

    setPlacing: (v) => set({ placing: v }),

    addColorway: async () => {
      const { captureFn, parts, layers, colorways } = get()
      if (!captureFn) return
      const thumb = await captureFn(384)
      const cw: Colorway = {
        id: `cw:${colorwaySeq++}`,
        name: `Colorway ${colorways.length + 1}`,
        thumb,
        parts: cloneParts(parts),
        layers: cloneLayers(layers),
      }
      set({ colorways: [...colorways, cw] })
    },

    applyColorway: (id) => {
      const cw = get().colorways.find((c) => c.id === id)
      if (!cw) return
      commit(`colorway:apply:${id}`)
      set({
        parts: cloneParts(cw.parts),
        layers: cloneLayers(cw.layers),
        selectedLayerId: null,
        activePanel: 'part',
        placing: false,
      })
    },

    removeColorway: (id) =>
      set((s) => ({ colorways: s.colorways.filter((c) => c.id !== id) })),

    renameColorway: (id, name) =>
      set((s) => ({
        colorways: s.colorways.map((c) => (c.id === id ? { ...c, name } : c)),
      })),

    clearGeneratedColorways: () =>
      set((s) => ({ colorways: s.colorways.filter((c) => !c.generated) })),

    /* ---- Auto-variant feature ---- */

    addVariable: (type, target, label, name) => {
      set((s) => {
        /* One variable per target — replace if the target is re-bound. */
        const others = s.variables.filter((v) => !sameTarget(v.target, target))
        /* Keep column names unique so spreadsheet headers map 1:1. */
        let col = name.trim() || label
        const taken = new Set(others.map((v) => v.name.toLowerCase()))
        if (taken.has(col.toLowerCase())) {
          let n = 2
          while (taken.has(`${col} ${n}`.toLowerCase())) n++
          col = `${col} ${n}`
        }
        const variable: DesignVariable = {
          id: `var:${varSeq++}`,
          name: col,
          type,
          target,
          label,
        }
        return { variables: [...others, variable] }
      })
    },

    removeVariable: (id) =>
      set((s) => ({ variables: s.variables.filter((v) => v.id !== id) })),

    removeVariableForTarget: (target) =>
      set((s) => ({
        variables: s.variables.filter((v) => !sameTarget(v.target, target)),
      })),

    renameVariable: (id, name) =>
      set((s) => ({
        variables: s.variables.map((v) => (v.id === id ? { ...v, name } : v)),
      })),

    setVariableEditable: (id, editable) =>
      set((s) => ({
        variables: s.variables.map((v) => (v.id === id ? { ...v, editable } : v)),
      })),

    /* ---- Roles, grouping & publishing ---- */

    setRole: (role) => {
      writeRole(role)
      set({ role })
      /* Leaving a design keeps context tidy when switching hats. */
      if (get().productId) get().closeProduct()
    },

    togglePartInSelection: (id) =>
      set((s) => {
        const selectedPartIds = s.selectedPartIds.includes(id)
          ? s.selectedPartIds.filter((x) => x !== id)
          : [...s.selectedPartIds, id]
        return {
          selectedPartIds,
          selectedPartId: id,
          highlightPartIds: selectedPartIds.length ? selectedPartIds : [id],
          activePanel: 'part',
        }
      }),

    clearPartSelection: () =>
      set((s) => ({
        selectedPartIds: [],
        highlightPartIds: s.selectedPartId ? [s.selectedPartId] : [],
      })),

    setHighlight: (ids) => set({ highlightPartIds: ids }),

    createGroupFromSelection: () => {
      const { selectedPartIds, parts, groups } = get()
      if (selectedPartIds.length < 2) return
      /* A part belongs to at most one group — drop the chosen parts from any
         existing group so groups stay disjoint. */
      const cleaned = groups
        .map((g) => ({ ...g, partIds: g.partIds.filter((p) => !selectedPartIds.includes(p)) }))
        .filter((g) => g.partIds.length >= 2)
      const members = parts.filter((p) => selectedPartIds.includes(p.id))
      const group: PartGroup = {
        id: `grp:${groupSeq++}`,
        name: `Group ${cleaned.length + 1}`,
        partIds: members.map((p) => p.id),
      }
      /* Seed a consumer-editable group-color variable so the group is useful
         out of the box. Uses the first member's color as the label hint. */
      const others = get().variables.filter((v) => !sameTarget(v.target, {
        kind: 'groupColor',
        groupId: group.id,
      }))
      const variable: DesignVariable = {
        id: `var:${varSeq++}`,
        name: group.name,
        type: 'color',
        target: { kind: 'groupColor', groupId: group.id },
        label: `${group.name} color`,
        editable: true,
      }
      set({
        groups: [...cleaned, group],
        variables: [...others, variable],
        selectedPartIds: [],
      })
      get().toast(`Grouped ${members.length} parts`)
    },

    removeGroup: (id) =>
      set((s) => ({
        groups: s.groups.filter((g) => g.id !== id),
        /* Drop the group's color variable with it. */
        variables: s.variables.filter(
          (v) => !(v.target.kind === 'groupColor' && v.target.groupId === id),
        ),
      })),

    renameGroup: (id, name) =>
      set((s) => ({
        groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)),
      })),

    setGroupColor: (groupId, color) => {
      const group = get().groups.find((g) => g.id === groupId)
      if (!group) return
      commit(`group:${groupId}:color`)
      set((s) => ({
        parts: s.parts.map((p) => {
          if (!group.partIds.includes(p.id)) return p
          const next = { ...p, color }
          if (next.texture?.patternId) {
            next.texture = { ...next.texture, src: renderPattern(next.texture.patternId, color) }
          }
          return next
        }),
      }))
    },

    publishArticle: async (name, description) => {
      const { captureFn, serializeDesign, publishedArticleId } = get()
      const base = serializeDesign()
      if (!base) return null
      const cleanName = name.trim() || 'Untitled article'

      /* Re-publish should UPDATE, not duplicate. Match the catalog entry by
         the id this design was last published under; failing that, by the
         same product + article name. Otherwise mint a fresh id. */
      const catalog = readCatalog()
      const existing =
        (publishedArticleId && catalog.find((a) => a.id === publishedArticleId)) ||
        catalog.find(
          (a) =>
            a.config.productId === base.productId &&
            a.name.trim().toLowerCase() === cleanName.toLowerCase(),
        ) ||
        null

      const id = existing?.id ?? `art:${articleSeq++}:${base.productId}`
      const now = Date.now()
      const thumb = captureFn ? await captureFn(512) : existing?.thumb ?? ''
      const article: PublishedArticle = {
        id,
        name: cleanName,
        description: description?.trim() || undefined,
        thumb,
        config: { ...base, publishedId: id },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      publishToCatalog(article)
      set({ publishedArticleId: id })
      get().toast(
        existing ? `Updated “${article.name}”` : `Published “${article.name}” to catalog`,
      )
      return article
    },

    addToCart: async () => {
      const { captureFn, serializeDesign, activeArticle, parts, layers, groups, variables, productId } =
        get()
      const config = serializeDesign()
      if (!config) return
      const product = productId ? productById(productId) : undefined
      const base = activeArticle?.config
      const baseParts = new Map((base?.parts ?? []).map((p) => [p.id, p]))
      const fontLabel = (id: string) => TEXT_FONTS.find((f) => f.id === id)?.label ?? id
      const zoneLabel = (id: string | null) =>
        product?.zones.find((z) => z.id === id)?.label ?? null

      /* Build a readable list of what the consumer changed vs the base. */
      const summary: string[] = []
      const groupedIds = new Set(groups.flatMap((g) => g.partIds))
      for (const g of groups) {
        const cur = parts.find((p) => g.partIds.includes(p.id))
        const wasP = base?.parts.find((p) => g.partIds.includes(p.id))
        if (cur && (!wasP || cur.color.toLowerCase() !== wasP.color.toLowerCase())) {
          summary.push(`${g.name}: ${cur.color.toUpperCase()}`)
        }
      }
      for (const p of parts) {
        if (groupedIds.has(p.id)) continue
        const was = baseParts.get(p.id)
        if (!was || p.color.toLowerCase() !== was.color.toLowerCase()) {
          if (was) summary.push(`${p.label}: ${p.color.toUpperCase()}`)
        }
      }
      for (const v of variables.filter((v) => v.editable)) {
        if (v.target.kind === 'layerText') {
          const l = layers.find((l) => l.id === (v.target as { layerId: string }).layerId)
          if (l?.text?.content) summary.push(`${v.name}: “${l.text.content}”`)
        } else if (v.target.kind === 'layerTextFont') {
          const l = layers.find((l) => l.id === (v.target as { layerId: string }).layerId)
          if (l?.text) summary.push(`${v.name}: ${fontLabel(l.text.font)}`)
        } else if (v.target.kind === 'layerTextColor') {
          const l = layers.find((l) => l.id === (v.target as { layerId: string }).layerId)
          if (l?.text) summary.push(`${v.name}: ${l.text.color.toUpperCase()}`)
        } else if (v.target.kind === 'layerPlacement') {
          const l = layers.find((l) => l.id === (v.target as { layerId: string }).layerId)
          const zl = zoneLabel(l?.zoneId ?? null)
          if (zl) summary.push(`${v.name}: ${zl}`)
        }
      }
      for (const l of layers.filter((l) => l.source === 'consumer')) {
        if (l.text) summary.push(`Added text: “${l.text.content}” (${fontLabel(l.text.font)})`)
        else summary.push('Added graphic')
      }
      if (summary.length === 0) summary.push('Original design (no changes)')

      const thumb = captureFn ? await captureFn(512) : activeArticle?.thumb ?? ''
      const item: CartItem = {
        id: `cart:${Date.now()}-${cartSeq++}`,
        articleId: activeArticle?.id ?? config.productId,
        articleName: activeArticle?.name ?? product?.name ?? 'Custom item',
        productId: config.productId,
        thumb,
        price: ITEM_PRICE,
        customizations: summary,
        config,
        addedAt: Date.now(),
      }
      set({ cart: addToCartStore(item) })
      get().toast('Added to cart')
    },

    removeFromCart: (id) => set({ cart: removeCartItem(id) }),
    clearCart: () => set({ cart: clearCartStore() }),
    setCartOpen: (v) => set({ cartOpen: v }),

    setVariantsOpen: (v) => set({ variantsOpen: v }),

    setLoadProgress: (p) => set({ loadProgress: p }),

    generateVariants: async (rows, resolver) => {
      const { captureFn, variables, groups } = get()
      const productId = get().productId
      const product = productId ? productById(productId) : undefined
      if (!captureFn || !product || rows.length === 0) return 0

      /* Snapshot the working design so we can apply each row on top of it
         and restore it afterwards. */
      const base = {
        parts: cloneParts(get().parts),
        layers: cloneLayers(get().layers),
      }
      const made: Colorway[] = []
      set({ variantProgress: { phase: 'generate', done: 0, total: rows.length } })
      try {
        for (let i = 0; i < rows.length; i++) {
          const applied = await applyVariant(
            base,
            variables,
            rows[i].values,
            resolver,
            product.zones,
            groups,
          )
          set({
            parts: applied.parts,
            layers: applied.layers,
            selectedLayerId: null,
            selectedPartId: applied.parts[0]?.id ?? null,
            activePanel: 'part',
            placing: false,
          })
          await settleFrames()
          const thumb = await captureFn(384)
          made.push({
            id: `cw:${colorwaySeq++}`,
            name: rows[i].name || `Variant ${i + 1}`,
            thumb,
            parts: applied.parts,
            layers: applied.layers,
            generated: true,
          })
          set({ variantProgress: { phase: 'generate', done: i + 1, total: rows.length } })
        }
      } finally {
        /* Restore the working design and append the generated colorways. */
        set((s) => ({
          parts: base.parts,
          layers: base.layers,
          selectedPartId: base.parts[0]?.id ?? null,
          selectedLayerId: null,
          activePanel: 'part',
          colorways: [...s.colorways, ...made],
          variantProgress: null,
        }))
      }
      return made.length
    },

    exportVariantPack: async (ids) => {
      const { captureFn, colorways, variables, productId } = get()
      const product = productId ? productById(productId) : undefined
      if (!captureFn || !product) return null
      const chosen = colorways.filter((c) => ids.includes(c.id))
      if (chosen.length === 0) return null

      const base = {
        parts: cloneParts(get().parts),
        layers: cloneLayers(get().layers),
      }
      const entries: ZipEntry[] = []
      const manifest: string[][] = [['index', 'name', 'folder']]
      const encoder = new TextEncoder()

      set({ variantProgress: { phase: 'export', done: 0, total: chosen.length } })
      try {
        for (let i = 0; i < chosen.length; i++) {
          const cw = chosen[i]
          set({
            parts: cloneParts(cw.parts),
            layers: cloneLayers(cw.layers),
            selectedLayerId: null,
            selectedPartId: cw.parts[0]?.id ?? null,
            activePanel: 'part',
            placing: false,
          })
          await settleFrames()
          const png = await captureFn(768)
          const slug = `${String(i + 1).padStart(2, '0')}-${slugify(cw.name)}`
          entries.push({ name: `${slug}/hero.png`, data: dataUrlToBytes(png) })
          const cfg = designConfigFor(productId!, cw.parts, cw.layers, variables)
          entries.push({
            name: `${slug}/config.json`,
            data: encoder.encode(JSON.stringify(cfg, null, 2)),
          })
          manifest.push([String(i + 1), cw.name, slug])
          set({ variantProgress: { phase: 'export', done: i + 1, total: chosen.length } })
        }
        entries.push({ name: 'variants.csv', data: encoder.encode(toCsv(manifest)) })
        return createZip(entries)
      } finally {
        set({
          parts: base.parts,
          layers: base.layers,
          selectedPartId: base.parts[0]?.id ?? null,
          selectedLayerId: null,
          activePanel: 'part',
          variantProgress: null,
        })
      }
    },

    setTechPackOpen: (v) => set({ techPackOpen: v }),

    toast: (msg) => {
      set({ toastMsg: msg })
      window.setTimeout(() => {
        if (get().toastMsg === msg) set({ toastMsg: null })
      }, 2200)
    },

    undo: () => {
      const snap = past.pop()
      if (!snap) return
      const { parts, layers } = get()
      future.push(cloneSnap({ parts, layers }))
      lastKey = ''
      set({
        ...snap,
        canUndo: past.length > 0,
        canRedo: true,
      })
    },

    redo: () => {
      const snap = future.pop()
      if (!snap) return
      const { parts, layers } = get()
      past.push(cloneSnap({ parts, layers }))
      lastKey = ''
      set({
        ...snap,
        canUndo: true,
        canRedo: future.length > 0,
      })
    },

    setCameraPreset: (id) =>
      set((s) => ({
        cameraPreset: id,
        cameraNonce: id ? s.cameraNonce + 1 : s.cameraNonce,
      })),

    focusOn: (target) =>
      set((s) => ({
        cameraFocus: { target, nonce: (s.cameraFocus?.nonce ?? 0) + 1 },
        cameraPreset: null,
      })),

    setAutoRotate: (v) => set({ autoRotate: v }),
    setSheetOpen: (v) => set({ sheetOpen: v }),
    setSheetTab: (t) => set({ sheetTab: t }),

    pushRecentColor: (c) =>
      set((s) => {
        const next = [c, ...s.recentColors.filter((x) => x !== c)].slice(0, 8)
        return { recentColors: next }
      }),

    setExportFn: (fn) => set({ exportFn: fn }),
    setExportHeroFn: (fn) => set({ exportHeroFn: fn }),
    setCaptureFn: (fn) => set({ captureFn: fn }),
    setExporting: (v) => set({ exporting: v }),

    serializeDesign: () => {
      const { productId, parts, layers, colorways, variables, groups, permissions, publishedArticleId } =
        get()
      if (!productId) return null
      return {
        app: 'apparel-studio',
        version: 5,
        productId,
        parts,
        layers,
        colorways,
        variables,
        groups,
        permissions,
        publishedId: publishedArticleId ?? undefined,
      }
    },
  }
})
