import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useLoader, useThree } from '@react-three/fiber'
import { Decal } from '@react-three/drei'
import type { DecalLayer } from '../../types'

/** Mesh-name prefix used to identify a decal during picking. */
export const DECAL_PREFIX = 'decal:'

/** Compose the projector orientation with the user's spin (around the
 *  projection axis) into a single euler for DecalGeometry. */
function composeRotation(
  rotation: [number, number, number],
  spin: number,
): THREE.Euler {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation))
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), spin))
  return new THREE.Euler().setFromQuaternion(q)
}

/** One artwork layer, projected onto its target mesh as a decal. */
export function LayerDecal({
  layer,
  order,
}: {
  layer: DecalLayer
  order: number
}) {
  const texture = useLoader(THREE.TextureLoader, layer.image)
  const invalidate = useThree((s) => s.invalidate)

  /* Under frameloop="demand" the texture resolves AFTER the frame that
     added the layer, so force a render once it (or the artwork) is ready
     — otherwise a just-added decal (e.g. text) stays invisible until the
     next interaction. */
  useEffect(() => {
    invalidate()
  }, [texture, layer.image, layer.position, layer.rotation, layer.spin, layer.scale, invalidate])

  const tex = useMemo(() => {
    const t = texture.clone()
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    if (layer.flipX) {
      t.wrapS = THREE.RepeatWrapping
      t.repeat.x = -1
      t.offset.x = 1
    } else {
      t.repeat.x = 1
      t.offset.x = 0
    }
    t.needsUpdate = true
    return t
  }, [texture, layer.flipX])

  const rotation = useMemo(
    () => composeRotation(layer.rotation, layer.spin),
    [layer.rotation, layer.spin],
  )

  const aspect =
    texture.image && texture.image.height
      ? texture.image.width / texture.image.height
      : 1

  if (!layer.visible) return null

  return (
    <Decal
      name={`${DECAL_PREFIX}${layer.id}`}
      position={layer.position}
      rotation={rotation}
      scale={[
        layer.scale * Math.max(aspect, 0.05),
        layer.scale,
        Math.max(layer.scale, 0.4),
      ]}
    >
      <meshStandardMaterial
        map={tex}
        transparent
        opacity={layer.opacity}
        polygonOffset
        polygonOffsetFactor={-4 - order}
        depthWrite={false}
        roughness={0.85}
        metalness={0}
      />
    </Decal>
  )
}
