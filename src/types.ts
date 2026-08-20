import type * as THREE from 'three'

/** Material preset identifiers available for every editable part. */
export type MaterialPresetId =
  | 'cotton'
  | 'denim'
  | 'fleece'
  | 'leather'
  | 'plastic'
  | 'mesh'

export interface MaterialPreset {
  id: MaterialPresetId
  label: string
  roughness: number
  metalness: number
}

/** Built-in procedural pattern identifiers. */
export type PatternId =
  | 'stripes'
  | 'diagonal'
  | 'check'
  | 'grid'
  | 'dots'
  | 'chevron'
  | 'camo'

/** A base-color texture applied to a part — uploaded image or pattern. */
export interface PartTexture {
  /** Base-color map as a data URL (uploaded image, or a rendered pattern). */
  src: string
  /** Tiling repeat count across the surface. */
  scale: number
  /** Rotation in degrees. */
  rotation: number
  /** Set when this is a procedural pattern, so it recolors with the part. */
  patternId?: PatternId
}

/** Live editable state for one part (mesh) of the product. */
export interface PartState {
  id: string
  /** Raw mesh name inside the model hierarchy. */
  meshName: string
  /** Prettified display name. */
  label: string
  color: string
  preset: MaterialPresetId
  roughness: number
  metalness: number
  visible: boolean
  /** Optional base-color texture / pattern. */
  texture?: PartTexture
  /** Free-form treatment / construction note for the tech pack. */
  note?: string
}

/** Defaults a model builder attaches to each mesh via userData. */
export interface PartDefaults {
  color: string
  preset: MaterialPresetId
}

/** A named artwork placement area on a product. */
export interface Zone {
  id: string
  label: string
  /** Name of the mesh the decal projects onto. */
  mesh: string
  /** Position in the mesh's local (geometry) space. */
  position: [number, number, number]
  /** Projector orientation (euler). */
  rotation: [number, number, number]
  /** Sensible default decal size for this zone. */
  scale: number
}

/** Editable text spec for text layers (rendered to the decal image). */
export interface TextSpec {
  content: string
  font: string
  weight: number
  color: string
}

/** One artwork layer, projected as a decal. Uploaded image or text. */
export interface DecalLayer {
  id: string
  name: string
  /** Artwork as a data URL — serializes into design JSON. */
  image: string
  /** Present when this layer is editable text. */
  text?: TextSpec
  mesh: string
  zoneId: string | null
  position: [number, number, number]
  rotation: [number, number, number]
  /** Extra spin (radians) applied around the projection axis. */
  spin: number
  scale: number
  /** Artwork width / height; drives the transform box aspect. */
  aspect: number
  opacity: number
  flipX: boolean
  visible: boolean
  /** Who added this layer. 'consumer' layers are personalizations added in
   *  the published article (when the designer allows it), shown with their
   *  own controls in the consumer customizer. Absent = designer-authored. */
  source?: 'designer' | 'consumer'
}

/** A saved snapshot of the full design state, with a rendered thumb. */
export interface Colorway {
  id: string
  name: string
  /** Rendered preview as a data URL. */
  thumb: string
  parts: PartState[]
  layers: DecalLayer[]
  /** True when produced by the auto-variant generator (vs. a manual snapshot). */
  generated?: boolean
}

/** What kind of value a design variable carries. */
export type VariableType = 'color' | 'text' | 'graphic' | 'placement' | 'font'

/** The element in the design a variable drives. */
export type VariableTarget =
  | { kind: 'partColor'; partId: string }
  | { kind: 'groupColor'; groupId: string }
  | { kind: 'layerText'; layerId: string }
  | { kind: 'layerTextColor'; layerId: string }
  | { kind: 'layerTextFont'; layerId: string }
  | { kind: 'layerImage'; layerId: string }
  | { kind: 'layerPlacement'; layerId: string }

/**
 * A designer-defined bundle of parts that behaves as one editable unit.
 * When a group's color is exposed to consumers, changing it recolors every
 * member part at once — so multiple meshes read as a single control.
 */
export interface PartGroup {
  id: string
  name: string
  /** Ids of the member parts (stable `${productId}/${meshName}` ids). */
  partIds: string[]
}

/** Which experience the app is presenting. */
export type Role = 'designer' | 'consumer'

/**
 * A named, spreadsheet-driven parameter. Each variable binds one target
 * (a part's color, a layer's text/artwork/placement) to a column name.
 * Importing a sheet fills these across rows to generate variants.
 */
export interface DesignVariable {
  id: string
  /** Column header this variable reads from the spreadsheet. */
  name: string
  type: VariableType
  target: VariableTarget
  /** Human-readable description of the bound target (for the UI). */
  label: string
  /**
   * When true, this variable is exposed to consumers: it becomes an
   * editable control in the published article's customizer. Designers see
   * and edit everything; consumers only see editable variables.
   */
  editable?: boolean
}

/**
 * What a consumer is allowed to do with a published article, beyond editing
 * the individual variables the designer marked editable.
 */
export interface ConsumerPermissions {
  /** Consumer may recolor any part or group (a blanket color permission). */
  changeColors?: boolean
  /** Consumer may add their own text layers. */
  addText?: boolean
  /** Consumer may add their own artwork/graphics. */
  addGraphic?: boolean
}

/** Serializable design document. */
export interface DesignConfig {
  app: 'apparel-studio'
  version: 1 | 2 | 3 | 4 | 5
  productId: string
  parts: PartState[]
  layers: DecalLayer[]
  /** Added in v2; absent in v1 files. */
  colorways?: Colorway[]
  /** Added in v3; absent in v1/v2 files. */
  variables?: DesignVariable[]
  /** Added in v4; part groups the designer bundled together. */
  groups?: PartGroup[]
  /** Added in v5; consumer capabilities for the published article. */
  permissions?: ConsumerPermissions
  /** Added in v5; the catalog id this design was last published under, so
   *  re-publishing updates that entry instead of creating a duplicate. */
  publishedId?: string
}

/**
 * A consumer's cart line: a customized article snapshot with a preview,
 * a human-readable list of the customizations, and a (dummy) price.
 */
export interface CartItem {
  id: string
  /** The published article this was customized from. */
  articleId: string
  articleName: string
  productId: string
  /** Rendered preview at add-to-cart time (data URL). */
  thumb: string
  /** Unit price in whole dollars (dummy pricing for now). */
  price: number
  /** Readable summary of what the consumer changed. */
  customizations: string[]
  /** Full design snapshot, so the exact item could be reproduced. */
  config: DesignConfig
  /** Epoch ms when added. */
  addedAt: number
}

/**
 * A design a designer published to the (local) catalog, browsable and
 * customizable by consumers. Wraps a full DesignConfig plus a hero thumb.
 */
export interface PublishedArticle {
  id: string
  /** Article name the designer set at publish time. */
  name: string
  /** Optional short blurb. */
  description?: string
  /** Rendered hero preview (data URL). */
  thumb: string
  /** The complete design, including which variables are consumer-editable. */
  config: DesignConfig
  /** Epoch ms when first published. */
  createdAt: number
  /** Epoch ms of the most recent (re-)publish. */
  updatedAt?: number
}

export type CameraPresetId =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'perspective'

export interface CameraPresetDef {
  id: CameraPresetId
  label: string
  position: [number, number, number]
  target: [number, number, number]
}

/**
 * A product entry. `build` returns a THREE.Group of named meshes.
 * Future GLTF products can instead provide a `url` — the auto-UI
 * pipeline only ever sees an Object3D hierarchy, so both paths work.
 */
export type ProductCategory = 'tops' | 'bottoms' | 'accessories'
export type Audience = 'men' | 'women' | 'kids'

export interface ProductDef {
  id: string
  name: string
  glyph: string
  tint: string
  build?: () => THREE.Group
  url?: string
  /** Loader to use for `url`. Defaults to glTF (GLB/GLTF); 'usdz' uses the
   *  USD loader (also reads .usd/.usda/.usdc). */
  format?: 'gltf' | 'usdz'
  /** For imported models: center, scale-to-fit, and strip embedded
   *  lights/cameras so an arbitrary model sits correctly in the camera. */
  fit?: boolean
  zones: Zone[]
  category: ProductCategory
  /** Which audiences this template suits (unisex = all three). */
  audiences: Audience[]
}

export type ExportBackground = 'transparent' | 'white' | 'studio'

export interface ExportOptions {
  background: ExportBackground
  size: number
}
