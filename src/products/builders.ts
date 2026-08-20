import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { PartDefaults } from '../types'

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

type Vec3 = [number, number, number]

interface Xform {
  p?: Vec3
  r?: Vec3
  s?: Vec3 | number
}

/** Bake a transform directly into a geometry so parts can be merged. */
function xf(geo: THREE.BufferGeometry, t: Xform = {}): THREE.BufferGeometry {
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(...(t.r ?? ([0, 0, 0] as Vec3))),
  )
  const s =
    typeof t.s === 'number'
      ? new THREE.Vector3(t.s, t.s, t.s)
      : new THREE.Vector3(...(t.s ?? ([1, 1, 1] as Vec3)))
  m.compose(new THREE.Vector3(...(t.p ?? ([0, 0, 0] as Vec3))), q, s)
  geo.applyMatrix4(m)
  return geo
}

/** Create a named part mesh from one or more geometries. */
function part(
  name: string,
  defaults: PartDefaults,
  ...geos: THREE.BufferGeometry[]
): THREE.Mesh {
  const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)!
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = false
  mesh.userData.partDefaults = defaults
  return mesh
}

function group(name: string, meshes: THREE.Mesh[], t: Xform = {}): THREE.Group {
  const g = new THREE.Group()
  g.name = name
  meshes.forEach((m) => g.add(m))
  if (t.p) g.position.set(...t.p)
  if (t.r) g.rotation.set(...t.r)
  if (t.s) {
    const s = typeof t.s === 'number' ? ([t.s, t.s, t.s] as Vec3) : t.s
    g.scale.set(...s)
  }
  return g
}

/** Smooth torso profile for shirts, closed at the hem and the neck. */
function torsoGeometry(bulk = 0): THREE.BufferGeometry {
  const b = bulk
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0, -1.4),
    new THREE.Vector2(1.02 + b, -1.4),
    new THREE.Vector2(0.97 + b, -0.6),
    new THREE.Vector2(0.96 + b, -0.1),
    new THREE.Vector2(1.0 + b, 0.5),
    new THREE.Vector2(0.97 + b, 0.85),
    new THREE.Vector2(0.9 + b, 1.05),
    new THREE.Vector2(0.52, 1.24),
    new THREE.Vector2(0.44, 1.26),
    new THREE.Vector2(0.2, 1.23),
    new THREE.Vector2(0.0, 1.22),
  ]
  return new THREE.LatheGeometry(pts, 56)
}

/**
 * Sleeve capsule. `side` is -1 (left) or +1 (right); `tilt` is the angle
 * from vertical in radians; returns geometry with transform baked in.
 */
function sleeveGeometry(
  side: -1 | 1,
  opts: { radius: number; length: number; tilt: number; center: [number, number] },
): THREE.BufferGeometry {
  const { radius, length, tilt, center } = opts
  return xf(new THREE.CapsuleGeometry(radius, length, 8, 28), {
    p: [side * center[0], center[1], 0],
    r: [0, 0, side * tilt],
  })
}

/* ------------------------------------------------------------------ */
/* Shirts                                                             */
/* ------------------------------------------------------------------ */

export function buildTShirt(): THREE.Group {
  const body = part(
    'Body',
    { color: '#F4F4F5', preset: 'cotton' },
    torsoGeometry(),
  )
  const sleeves = part(
    'Sleeves',
    { color: '#F4F4F5', preset: 'cotton' },
    sleeveGeometry(-1, { radius: 0.31, length: 0.6, tilt: 1.02, center: [1.16, 0.58] }),
    sleeveGeometry(1, { radius: 0.31, length: 0.6, tilt: 1.02, center: [1.16, 0.58] }),
  )
  const collar = part(
    'Collar',
    { color: '#E4E4E7', preset: 'cotton' },
    xf(new THREE.TorusGeometry(0.46, 0.075, 18, 48), {
      p: [0, 1.26, 0],
      r: [Math.PI / 2, 0, 0],
    }),
  )
  return group('T Shirt', [body, sleeves, collar], { p: [0, 0.1, 0] })
}

export function buildPolo(): THREE.Group {
  const body = part(
    'Body',
    { color: '#1F3A5F', preset: 'cotton' },
    torsoGeometry(),
  )
  const sleeves = part(
    'Sleeves',
    { color: '#1F3A5F', preset: 'cotton' },
    sleeveGeometry(-1, { radius: 0.31, length: 0.6, tilt: 1.02, center: [1.16, 0.58] }),
    sleeveGeometry(1, { radius: 0.31, length: 0.6, tilt: 1.02, center: [1.16, 0.58] }),
  )
  const collar = part(
    'Collar',
    { color: '#EDEDF0', preset: 'cotton' },
    xf(new THREE.CylinderGeometry(0.54, 0.44, 0.22, 40, 1, true), {
      p: [0, 1.3, 0],
    }),
  )
  const placket = part(
    'Placket',
    { color: '#1A3253', preset: 'cotton' },
    xf(new THREE.BoxGeometry(0.17, 0.5, 0.04), {
      p: [0, 0.85, 0.93],
      r: [0.16, 0, 0],
    }),
  )
  const buttons = part(
    'Buttons',
    { color: '#F8F8F8', preset: 'plastic' },
    xf(new THREE.SphereGeometry(0.042, 16, 12), { p: [0, 1.0, 0.915] }),
    xf(new THREE.SphereGeometry(0.042, 16, 12), { p: [0, 0.85, 0.95] }),
    xf(new THREE.SphereGeometry(0.042, 16, 12), { p: [0, 0.7, 0.965] }),
  )
  return group('Polo', [body, sleeves, collar, placket, buttons], { p: [0, 0.1, 0] })
}

export function buildSweatshirt(): THREE.Group {
  const tilt = 0.3
  const body = part(
    'Body',
    { color: '#9CA3AF', preset: 'fleece' },
    torsoGeometry(0.06),
  )
  const sleeves = part(
    'Sleeves',
    { color: '#9CA3AF', preset: 'fleece' },
    sleeveGeometry(-1, { radius: 0.3, length: 1.35, tilt, center: [1.25, 0.12] }),
    sleeveGeometry(1, { radius: 0.3, length: 1.35, tilt, center: [1.25, 0.12] }),
  )
  const wrist = (side: -1 | 1) =>
    xf(new THREE.TorusGeometry(0.29, 0.07, 14, 36), {
      p: [side * (1.25 + Math.sin(tilt) * 0.72), 0.12 - Math.cos(tilt) * 0.72, 0],
      r: [Math.PI / 2, 0, side * tilt],
    })
  const cuffs = part(
    'Cuffs',
    { color: '#848B96', preset: 'fleece' },
    wrist(-1),
    wrist(1),
  )
  const collar = part(
    'Collar',
    { color: '#848B96', preset: 'fleece' },
    xf(new THREE.TorusGeometry(0.48, 0.09, 16, 48), {
      p: [0, 1.28, 0],
      r: [Math.PI / 2, 0, 0],
    }),
  )
  const hem = part(
    'Hem',
    { color: '#848B96', preset: 'fleece' },
    xf(new THREE.TorusGeometry(1.04, 0.08, 16, 56), {
      p: [0, -1.36, 0],
      r: [Math.PI / 2, 0, 0],
    }),
  )
  return group('Sweatshirt', [body, sleeves, cuffs, collar, hem], { p: [0, 0.1, 0] })
}

export function buildHoodie(): THREE.Group {
  const tilt = 0.3
  const body = part(
    'Body',
    { color: '#3F3F46', preset: 'fleece' },
    torsoGeometry(0.08),
  )
  const sleeves = part(
    'Sleeves',
    { color: '#3F3F46', preset: 'fleece' },
    sleeveGeometry(-1, { radius: 0.31, length: 1.35, tilt, center: [1.27, 0.12] }),
    sleeveGeometry(1, { radius: 0.31, length: 1.35, tilt, center: [1.27, 0.12] }),
  )
  const hood = part(
    'Hood',
    { color: '#3F3F46', preset: 'fleece' },
    xf(new THREE.SphereGeometry(0.56, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.6), {
      p: [0, 1.22, -0.38],
      r: [-0.75, 0, 0],
      s: [1, 1.1, 1.2],
    }),
  )
  const pocket = part(
    'Pocket',
    { color: '#34343A', preset: 'fleece' },
    xf(new THREE.BoxGeometry(1.15, 0.52, 0.2), {
      p: [0, -0.85, 1.0],
      r: [-0.06, 0, 0],
    }),
  )
  const strings = part(
    'Drawstrings',
    { color: '#D4D4D8', preset: 'cotton' },
    xf(new THREE.CapsuleGeometry(0.025, 0.36, 4, 10), {
      p: [-0.18, 0.82, 1.05],
      r: [0.14, 0, 0.06],
    }),
    xf(new THREE.CapsuleGeometry(0.025, 0.36, 4, 10), {
      p: [0.18, 0.82, 1.05],
      r: [0.14, 0, -0.06],
    }),
  )
  return group('Hoodie', [body, sleeves, hood, pocket, strings], { p: [0, 0.1, 0] })
}

/* ------------------------------------------------------------------ */
/* Headwear                                                           */
/* ------------------------------------------------------------------ */

/** Flat pie-wedge visor centred on +z. */
function visorGeometry(curved: boolean): THREE.BufferGeometry {
  const wedge = new THREE.CylinderGeometry(
    0.98,
    0.98,
    0.05,
    36,
    1,
    false,
    -Math.PI * 0.42,
    Math.PI * 0.84,
  )
  return xf(wedge, {
    p: [0, curved ? 0.1 : 0.06, 0.42],
    r: [curved ? -0.32 : -0.06, 0, 0],
    s: [0.92, 1, 1.12],
  })
}

function crownGeometry(radius = 0.88): THREE.BufferGeometry {
  return xf(
    new THREE.SphereGeometry(radius, 48, 26, 0, Math.PI * 2, 0, Math.PI * 0.52),
    { s: [1, 0.92, 1] },
  )
}

export function buildCap(): THREE.Group {
  const crown = part('Crown', { color: '#18181B', preset: 'cotton' }, crownGeometry())
  const visor = part('Visor', { color: '#18181B', preset: 'cotton' }, visorGeometry(false))
  const button = part(
    'Button',
    { color: '#18181B', preset: 'plastic' },
    xf(new THREE.SphereGeometry(0.07, 16, 12), { p: [0, 0.82, 0] }),
  )
  const strap = part(
    'Strap',
    { color: '#26262B', preset: 'plastic' },
    xf(new THREE.BoxGeometry(0.52, 0.13, 0.06), { p: [0, 0.1, -0.85] }),
  )
  return group('Cap', [crown, visor, button, strap], { p: [0, -0.55, 0], s: 1.55 })
}

export function buildBaseballCap(): THREE.Group {
  const crown = part('Crown', { color: '#B91C1C', preset: 'cotton' }, crownGeometry())
  const front = part(
    'Front Panel',
    { color: '#F4F4F5', preset: 'cotton' },
    xf(
      new THREE.SphereGeometry(
        0.895,
        36,
        18,
        Math.PI / 2 - 0.72,
        1.44,
        Math.PI * 0.12,
        Math.PI * 0.34,
      ),
      { s: [1, 0.92, 1] },
    ),
  )
  const visor = part('Visor', { color: '#B91C1C', preset: 'cotton' }, visorGeometry(true))
  const button = part(
    'Button',
    { color: '#B91C1C', preset: 'plastic' },
    xf(new THREE.SphereGeometry(0.07, 16, 12), { p: [0, 0.82, 0] }),
  )
  return group('Baseball Cap', [crown, front, visor, button], { p: [0, -0.55, 0], s: 1.55 })
}

export function buildBucketHat(): THREE.Group {
  const crown = part(
    'Crown',
    { color: '#D6C7A1', preset: 'cotton' },
    new THREE.CylinderGeometry(0.72, 0.8, 0.6, 48),
    xf(new THREE.SphereGeometry(0.72, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.4), {
      p: [0, 0.24, 0],
      s: [1, 0.5, 1],
    }),
  )
  const band = part(
    'Band',
    { color: '#8A7A57', preset: 'cotton' },
    xf(new THREE.CylinderGeometry(0.815, 0.825, 0.16, 48, 1, true), {
      p: [0, -0.16, 0],
    }),
  )
  const brim = part(
    'Brim',
    { color: '#D6C7A1', preset: 'cotton' },
    xf(new THREE.CylinderGeometry(0.8, 1.32, 0.34, 56, 1, true), {
      p: [0, -0.42, 0],
    }),
  )
  return group('Bucket Hat', [crown, band, brim], { p: [0, -0.35, 0], s: 1.5 })
}

export function buildBeanie(): THREE.Group {
  const dome = part(
    'Dome',
    { color: '#0F766E', preset: 'fleece' },
    xf(new THREE.SphereGeometry(0.82, 48, 26, 0, Math.PI * 2, 0, Math.PI * 0.58), {
      s: [1, 1.18, 1],
    }),
  )
  const cuff = part(
    'Cuff',
    { color: '#0B5E58', preset: 'fleece' },
    xf(new THREE.CylinderGeometry(0.86, 0.84, 0.38, 48, 1, true), {
      p: [0, -0.05, 0],
    }),
  )
  const pom = part(
    'Pom',
    { color: '#F4F4F5', preset: 'fleece' },
    xf(new THREE.SphereGeometry(0.17, 20, 14), { p: [0, 1.02, 0] }),
  )
  return group('Beanie', [dome, cuff, pom], { p: [0, -0.5, 0], s: 1.45 })
}

/* ------------------------------------------------------------------ */
/* Bottoms                                                            */
/* ------------------------------------------------------------------ */

/** Tapered leg tube; side -1 (left) / +1 (right). */
function legGeometry(
  side: -1 | 1,
  opts: { topR: number; botR: number; len: number; x: number; cy: number; tilt?: number },
): THREE.BufferGeometry {
  const { topR, botR, len, x, cy, tilt = 0.02 } = opts
  return xf(new THREE.CylinderGeometry(topR, botR, len, 32, 1, false), {
    p: [side * x, cy, 0],
    r: [0, 0, side * -tilt],
  })
}

/** Hip/seat block from a smooth lathe profile (waist → hip). */
function hipGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, 0.55),
    new THREE.Vector2(0.66, 0.55),
    new THREE.Vector2(0.72, 0.3),
    new THREE.Vector2(0.86, 0.0),
    new THREE.Vector2(0.9, -0.25),
    new THREE.Vector2(0.84, -0.45),
    new THREE.Vector2(0.0, -0.5),
  ]
  return new THREE.LatheGeometry(pts, 48)
}

export function buildShorts(): THREE.Group {
  const col = '#1F3A5F'
  const waistband = part(
    'Waistband',
    { color: '#16293F', preset: 'denim' },
    xf(new THREE.CylinderGeometry(0.68, 0.68, 0.18, 48, 1, true), { p: [0, 0.52, 0] }),
  )
  const hips = part('Hips', { color: col, preset: 'denim' }, hipGeometry())
  const legL = part(
    'Left Leg',
    { color: col, preset: 'denim' },
    legGeometry(-1, { topR: 0.46, botR: 0.5, len: 0.85, x: 0.4, cy: -0.9 }),
  )
  const legR = part(
    'Right Leg',
    { color: col, preset: 'denim' },
    legGeometry(1, { topR: 0.46, botR: 0.5, len: 0.85, x: 0.4, cy: -0.9 }),
  )
  return group('Shorts', [waistband, hips, legL, legR], { p: [0, 0.3, 0], s: 1.2 })
}

export function buildJoggers(): THREE.Group {
  const col = '#3F3F46'
  const waistband = part(
    'Waistband',
    { color: '#2C2C31', preset: 'fleece' },
    xf(new THREE.CylinderGeometry(0.66, 0.66, 0.2, 48, 1, true), { p: [0, 0.52, 0] }),
  )
  const hips = part('Hips', { color: col, preset: 'fleece' }, hipGeometry())
  const leg = (side: -1 | 1, name: string) =>
    part(
      name,
      { color: col, preset: 'fleece' },
      legGeometry(side, { topR: 0.42, botR: 0.3, len: 1.75, x: 0.38, cy: -1.42, tilt: 0.015 }),
    )
  const cuff = (side: -1 | 1) =>
    xf(new THREE.TorusGeometry(0.28, 0.08, 14, 32), {
      p: [side * 0.36, -2.26, 0],
      r: [Math.PI / 2, 0, 0],
    })
  const cuffs = part('Cuffs', { color: '#2C2C31', preset: 'fleece' }, cuff(-1), cuff(1))
  const strings = part(
    'Drawstring',
    { color: '#D4D4D8', preset: 'cotton' },
    xf(new THREE.CapsuleGeometry(0.03, 0.34, 4, 10), { p: [-0.14, 0.4, 0.6], r: [0.2, 0, 0.05] }),
    xf(new THREE.CapsuleGeometry(0.03, 0.34, 4, 10), { p: [0.14, 0.4, 0.6], r: [0.2, 0, -0.05] }),
  )
  return group('Joggers', [waistband, hips, leg(-1, 'Left Leg'), leg(1, 'Right Leg'), cuffs, strings], {
    p: [0, 0.6, 0],
    s: 1.05,
  })
}

export function buildSkirt(): THREE.Group {
  const col = '#7A1F3D'
  const waistband = part(
    'Waistband',
    { color: '#5E1730', preset: 'cotton' },
    xf(new THREE.CylinderGeometry(0.62, 0.62, 0.2, 48, 1, true), { p: [0, 0.5, 0] }),
  )
  const skirt = part(
    'Skirt',
    { color: col, preset: 'cotton' },
    xf(new THREE.CylinderGeometry(0.62, 1.55, 1.7, 64, 1, true), { p: [0, -0.45, 0] }),
  )
  const hem = part(
    'Hem',
    { color: '#5E1730', preset: 'cotton' },
    xf(new THREE.TorusGeometry(1.55, 0.05, 12, 72), { p: [0, -1.3, 0], r: [Math.PI / 2, 0, 0] }),
  )
  return group('Skirt', [waistband, skirt, hem], { p: [0, 0.35, 0], s: 1.15 })
}
