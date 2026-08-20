import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createPortal, useLoader, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useGLTF, Outlines } from '@react-three/drei'
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js'
import { prettifyName, useStudio } from '../../store'
import { presetById } from '../../materials/presets'
import { getFabricMaps } from '../../materials/fabricTextures'
import type { PartDefaults, PartState, ProductDef } from '../../types'
import { DECAL_PREFIX, LayerDecal } from './DecalLayer'
import { GizmoProjector } from './GizmoProjector'

const lookHelper = new THREE.Object3D()

/**
 * Picks the model source: procedural build(), a glTF url, or a USD(Z) url.
 * All resolve to a THREE.Group the shared ModelEditor drives, so the
 * auto-UI, decals, and gizmo work identically regardless of source format.
 */
export function ProductModel({ product }: { product: ProductDef }) {
  if (!product.url) return <BuiltModel product={product} />
  return product.format === 'usdz' ? (
    <UsdzModel product={product} />
  ) : (
    <GltfModel product={product} />
  )
}

function BuiltModel({ product }: { product: ProductDef }) {
  const model = useMemo(() => product.build!(), [product])
  return <ModelEditor product={product} model={model} />
}

/** Target size (largest bounding-box dimension) for a fitted import. */
const FIT_TARGET = 2.7

/**
 * Clone a loaded scene (and its materials) so edits don't leak into the
 * loader cache, and — when `fit` is set — bake a normalized, centered
 * coordinate space into a flat group of meshes so an arbitrary imported
 * model (glTF or USD) fills the camera and its meshes share the same
 * convention as the procedural products. Per-instance geometries/materials
 * are disposed on unmount so repeated model swaps don't leak GPU memory.
 */
function useNormalizedModel(source: THREE.Object3D, fit?: boolean): THREE.Object3D {
  const owned = useRef<{ geometries: THREE.BufferGeometry[]; materials: THREE.Material[] }>({
    geometries: [],
    materials: [],
  })

  const model = useMemo(() => {
    owned.current = { geometries: [], materials: [] }
    const clone = source.clone(true)
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mat = (o.material as THREE.Material).clone()
        o.material = mat
        owned.current.materials.push(mat)
      }
    })
    if (!fit) return clone

    clone.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(clone)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const s = FIT_TARGET / maxDim
    const norm = new THREE.Matrix4()
      .makeScale(s, s, s)
      .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z))

    const flat = new THREE.Group()
    const seen = new Set<string>()
    const meshes: THREE.Mesh[] = []
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o)
    })
    for (const m of meshes) {
      m.updateMatrixWorld(true)
      const geom = m.geometry.clone()
      geom.applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, m.matrixWorld))
      owned.current.geometries.push(geom) /* new per-instance geometry → dispose later */
      let name = m.name || 'Part'
      /* Keep mesh names unique so each becomes a distinct editable part. */
      if (seen.has(name)) {
        let n = 2
        while (seen.has(`${name} ${n}`)) n++
        name = `${name} ${n}`
      }
      seen.add(name)
      const nm = new THREE.Mesh(geom, m.material)
      nm.name = name
      nm.userData = { ...m.userData }
      nm.castShadow = true
      nm.receiveShadow = true
      flat.add(nm)
    }
    return flat
  }, [source, fit])

  useEffect(() => {
    const res = owned.current
    return () => {
      for (const g of res.geometries) g.dispose()
      for (const m of res.materials) m.dispose()
    }
  }, [model])

  return model
}

function GltfModel({ product }: { product: ProductDef }) {
  const { scene } = useGLTF(product.url!)
  const model = useNormalizedModel(scene, product.fit)
  return <ModelEditor product={product} model={model} />
}

function UsdzModel({ product }: { product: ProductDef }) {
  /* USD(Z) via three's USDLoader — handles the zipped .usdz package as
     well as raw .usd/.usda/.usdc, returning a THREE scene we normalize
     and drive through the very same editor pipeline as glTF. */
  const scene = useLoader(USDLoader, product.url!) as unknown as THREE.Object3D
  const model = useNormalizedModel(scene, product.fit)
  return <ModelEditor product={product} model={model} />
}

/**
 * AUTO-GENERATES the editable part list by traversing the hierarchy —
 * nothing is hardcoded, so any GLTF apparel model plugs into the same
 * pipeline. Also renders decal layers (portaled into their target
 * meshes), lets you grab a decal and drag it across the fabric, and
 * drives the transform gizmo.
 */
function ModelEditor({
  product,
  model,
}: {
  product: ProductDef
  model: THREE.Object3D
}) {
  const initParts = useStudio((s) => s.initParts)
  const setPrimaryMesh = useStudio((s) => s.setPrimaryMesh)
  const selectPart = useStudio((s) => s.selectPart)
  const selectLayer = useStudio((s) => s.selectLayer)
  const setSheetOpen = useStudio((s) => s.setSheetOpen)
  const parts = useStudio((s) => s.parts)
  const layers = useStudio((s) => s.layers)
  const highlightPartIds = useStudio((s) => s.highlightPartIds)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const invalidate = useThree((s) => s.invalidate)

  /** Which layer is currently being dragged across the surface. */
  const dragLayerId = useRef<string | null>(null)

  /** Per-part base-color textures we own (keyed by part id), for reuse and
   *  disposal. Kept off React state — they're GPU resources. */
  const partTextures = useRef(new Map<string, { src: string; tex: THREE.Texture }>())
  const textureLoader = useMemo(() => new THREE.TextureLoader(), [])

  /** meshName → Mesh lookup for decal portals + raycasting. */
  const meshMap = useMemo(() => {
    const map = new Map<string, THREE.Mesh>()
    model?.traverse((obj) => {
      if (obj instanceof THREE.Mesh) map.set(obj.name, obj)
    })
    return map
  }, [model])

  /* Generate editable nodes from the mesh hierarchy, and note the largest
     mesh so imported models get a sensible default decal target. */
  useEffect(() => {
    if (!model) return
    const generated: PartState[] = []
    const box = new THREE.Box3()
    const sizeV = new THREE.Vector3()
    let primary: string | null = null
    let maxArea = -1
    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const defaults = (obj.userData.partDefaults ?? {
        color: '#D4D4D8',
        preset: 'cotton',
      }) as PartDefaults
      const preset = presetById(defaults.preset)
      generated.push({
        id: `${product.id}/${obj.name || obj.uuid}`,
        meshName: obj.name || obj.uuid,
        label: prettifyName(obj.name || 'Part'),
        color: defaults.color,
        preset: defaults.preset,
        roughness: preset.roughness,
        metalness: preset.metalness,
        visible: true,
      })
      obj.geometry.computeBoundingBox()
      if (obj.geometry.boundingBox) {
        box.copy(obj.geometry.boundingBox).getSize(sizeV)
        const area = sizeV.x * sizeV.y + sizeV.y * sizeV.z + sizeV.x * sizeV.z
        if (area > maxArea) {
          maxArea = area
          primary = obj.name || obj.uuid
        }
      }
    })
    /* A model with no meshes (e.g. an unparseable/corrupt file that still
       produced an empty scene) can't be edited — bail back to the picker. */
    if (generated.length === 0) {
      const s = useStudio.getState()
      s.toast("That model had no editable meshes — try a different file.")
      s.closeProduct()
      return
    }
    initParts(generated)
    setPrimaryMesh(primary)
  }, [model, product.id, initParts, setPrimaryMesh])

  useEffect(() => {
    if (product.url && product.format !== 'usdz') useGLTF.preload(product.url)
  }, [product.url, product.format])

  /* Free part textures when this model unmounts. */
  useEffect(() => {
    const tex = partTextures.current
    return () => {
      for (const e of tex.values()) e.tex.dispose()
      tex.clear()
    }
  }, [])

  /* Apply live part state to materials (mutates, no material churn).
     Each material preset also carries a procedural fabric normal map so
     it reads as a real material, plus an env-map intensity for sheen. */
  useEffect(() => {
    if (!model) return
    const byName = new Map(parts.map((p) => [p.meshName, p]))
    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const st = byName.get(obj.name)
      if (!st) return
      const mat = obj.material as THREE.MeshStandardMaterial

      /* Base-color texture / pattern. The map carries its own colors, so
         the flat color is set to white when a texture is present. Repeat
         and rotation update live on the shared texture (no reload); only a
         changed source reloads (and the map add/remove recompiles once). */
      if (st.texture) {
        let entry = partTextures.current.get(st.id)
        if (!entry || entry.src !== st.texture.src) {
          if (entry) entry.tex.dispose()
          const tex = textureLoader.load(st.texture.src, () => invalidate())
          tex.colorSpace = THREE.SRGBColorSpace
          tex.wrapS = THREE.RepeatWrapping
          tex.wrapT = THREE.RepeatWrapping
          tex.center.set(0.5, 0.5)
          tex.anisotropy = 8
          entry = { src: st.texture.src, tex }
          partTextures.current.set(st.id, entry)
          mat.map = tex
          mat.needsUpdate = true
        }
        entry.tex.repeat.set(st.texture.scale, st.texture.scale)
        entry.tex.rotation = (st.texture.rotation * Math.PI) / 180
        mat.color.set('#ffffff')
      } else {
        const entry = partTextures.current.get(st.id)
        if (entry) {
          entry.tex.dispose()
          partTextures.current.delete(st.id)
          mat.map = null
          mat.needsUpdate = true
        }
        mat.color.set(st.color)
      }

      mat.roughness = st.roughness
      mat.metalness = st.metalness
      obj.visible = st.visible

      const fabric = getFabricMaps(st.preset)
      if (mat.normalMap !== fabric.normalMap) {
        /* Recompile the shader ONLY when the presence of a normal map
           changes (first assignment). Swapping one normal-map texture for
           another is just a uniform rebind — forcing needsUpdate on every
           preset switch triggers a full GLSL recompile and janks the main
           thread (hundreds of ms), which is the material-switch freeze. */
        const hadNormal = !!mat.normalMap
        mat.normalMap = fabric.normalMap
        if (hadNormal !== !!fabric.normalMap) mat.needsUpdate = true
      }
      mat.normalScale.set(fabric.normalScale, fabric.normalScale)
      mat.envMapIntensity = fabric.envMapIntensity
    })
    /* Demand frameloop: material edits aren't React props, so request a
       render explicitly. */
    invalidate()
  }, [model, parts, invalidate])

  /* Re-render when the selection outline set changes (demand frameloop). */
  useEffect(() => {
    invalidate()
  }, [highlightPartIds, invalidate])

  /** Reposition a layer to the surface point under the pointer. Snaps to
     the FRONTMOST editable part mesh (not decals), so a decal always
     lands on the visible surface even where meshes overlap — and can be
     dragged across mesh boundaries. */
  const placeAt = (layerId: string, e: ThreeEvent<PointerEvent>) => {
    const layer = useStudio.getState().layers.find((l) => l.id === layerId)
    if (!layer) return
    const hit = e.intersections.find(
      (i) =>
        i.face &&
        !i.object.name.startsWith(DECAL_PREFIX) &&
        parts.some((p) => p.meshName === i.object.name),
    )
    if (!hit || !hit.face) return
    const local = hit.object.worldToLocal(hit.point.clone())
    lookHelper.position.copy(local)
    lookHelper.lookAt(local.clone().add(hit.face.normal))
    useStudio.getState().updateLayer(layerId, {
      mesh: hit.object.name,
      position: [local.x, local.y, local.z],
      rotation: [
        lookHelper.rotation.x,
        lookHelper.rotation.y,
        lookHelper.rotation.z,
      ],
      zoneId: null,
    })
  }

  const endDrag = () => {
    if (!dragLayerId.current) return
    dragLayerId.current = null
    if (controls) controls.enabled = true
  }

  const beginDrag = (layerId: string) => {
    dragLayerId.current = layerId
    if (controls) controls.enabled = false
    /* End on a window pointerup — r3f's onPointerLeave fires spuriously
       as the pointer crosses between the decal and garment sub-objects,
       which would otherwise abort the drag mid-gesture. */
    window.addEventListener('pointerup', endDrag, { once: true })
    window.addEventListener('pointercancel', endDrag, { once: true })
  }

  const onModelDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const s = useStudio.getState()

    /* Explicit "position by dragging" mode from the layer editor. */
    if (s.placing && s.selectedLayerId) {
      beginDrag(s.selectedLayerId)
      placeAt(s.selectedLayerId, e)
      return
    }

    /* Decal and garment are near-coincident, so pick from the full
       intersection list rather than relying on hit order: if a decal is
       under the pointer (within epsilon of the nearest surface hit),
       grab it; otherwise select the part beneath. */
    const nearest = e.intersections[0]?.distance ?? Infinity
    const decalHit = e.intersections.find(
      (i) =>
        i.object.name.startsWith(DECAL_PREFIX) &&
        i.distance <= nearest + 0.02,
    )
    if (decalHit) {
      const layerId = decalHit.object.name.slice(DECAL_PREFIX.length)
      selectLayer(layerId)
      setSheetOpen(true)
      beginDrag(layerId)
      placeAt(layerId, e)
      return
    }

    /* Pointer-intent gating: defer part selection to pointerup and only
       apply it if the pointer barely moved — an orbit drag must not
       change the selected part. Pick the frontmost intersection that is an
       actual part mesh, so a selection-outline hull (or decal) in front
       doesn't swallow the click. */
    const partHit = e.intersections.find((i) =>
      parts.some((p) => p.meshName === i.object.name),
    )
    const hit = partHit ? parts.find((p) => p.meshName === partHit.object.name) : undefined
    if (!hit) return
    const startX = e.nativeEvent.clientX
    const startY = e.nativeEvent.clientY
    let moved = false
    const onWinMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) moved = true
    }
    const onWinUp = () => {
      window.removeEventListener('pointermove', onWinMove)
      if (!moved) {
        selectPart(hit.id)
        setSheetOpen(true)
      }
    }
    window.addEventListener('pointermove', onWinMove)
    window.addEventListener('pointerup', onWinUp, { once: true })
  }

  /* Cap surface-drag updates to ~60/s. Each placeAt rebuilds the decal's
     projected geometry synchronously, and high-rate mice fire pointermove
     far faster than 60Hz — throttling keeps a fast drag from locking the
     main thread. */
  const lastMove = useRef(0)
  const onModelMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragLayerId.current) return
    e.stopPropagation()
    const now = e.nativeEvent.timeStamp || performance.now()
    if (now - lastMove.current < 16) return
    lastMove.current = now
    placeAt(dragLayerId.current, e)
  }

  const onModelDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    useStudio.getState().focusOn([e.point.x, e.point.y, e.point.z])
  }

  return (
    <>
      <primitive
        object={model}
        onPointerDown={onModelDown}
        onPointerMove={onModelMove}
        onDoubleClick={onModelDoubleClick}
      />
      {layers.map((layer, i) => {
        const mesh = meshMap.get(layer.mesh)
        if (!mesh) return null
        return createPortal(
          <Suspense key={layer.id} fallback={null}>
            <LayerDecal layer={layer} order={i} />
          </Suspense>,
          mesh,
        )
      })}
      {/* Selection outline: an inverted-hull edge around each highlighted
          part, portaled into its mesh so it tracks the geometry exactly.
          Works the same in designer and consumer views. */}
      {parts.map((p) => {
        if (!highlightPartIds.includes(p.id) || !p.visible) return null
        const mesh = meshMap.get(p.meshName)
        if (!mesh) return null
        return createPortal(
          <Outlines
            key={`outline:${p.id}`}
            color="#00AAE7"
            thickness={0.045}
            transparent
            opacity={1}
          />,
          mesh,
        )
      })}
      <GizmoProjector meshMap={meshMap} />
    </>
  )
}
