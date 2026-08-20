import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStudio } from '../../store'
import { gizmoBus } from './gizmoBus'

const center = new THREE.Vector3()
const right = new THREE.Vector3()
const up = new THREE.Vector3()
const normal = new THREE.Vector3()
const viewDir = new THREE.Vector3()
const q = new THREE.Quaternion()
const meshQ = new THREE.Quaternion()
const layerQ = new THREE.Quaternion()
const euler = new THREE.Euler()
const tmp = new THREE.Vector3()

/**
 * Projects the selected decal's oriented bounding box into screen space
 * each frame and publishes it to gizmoBus for the DOM overlay. Hidden
 * when nothing is selected, the layer is hidden, or the decal faces away
 * from the camera (so you never grab the handle on the far side).
 */
export function GizmoProjector({
  meshMap,
}: {
  meshMap: Map<string, THREE.Mesh>
}) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useFrame(() => {
    const s = useStudio.getState()
    const layer =
      s.activePanel === 'layer' && s.selectedLayerId
        ? s.layers.find((l) => l.id === s.selectedLayerId)
        : undefined

    if (!layer || !layer.visible) {
      gizmoBus.screen = null
      return
    }
    const mesh = meshMap.get(layer.mesh)
    if (!mesh) {
      gizmoBus.screen = null
      return
    }

    mesh.updateWorldMatrix(true, false)
    mesh.getWorldQuaternion(meshQ)
    layerQ.setFromEuler(euler.set(...layer.rotation))
    q.copy(meshQ).multiply(layerQ)

    center.set(...layer.position)
    mesh.localToWorld(center)

    /* drei's <Decal scale> is the full box size, so half-extents are
       half of that. */
    const hw = (layer.scale * Math.max(layer.aspect || 1, 0.05)) / 2
    const hh = layer.scale / 2
    right.set(1, 0, 0).applyQuaternion(q)
    up.set(0, 1, 0).applyQuaternion(q)

    /* Back-face cull: if the surface normal points the same way as the
       camera→center direction, the decal is on the far side. */
    normal.crossVectors(right, up)
    viewDir.copy(center).sub(camera.position)
    if (normal.dot(viewDir) > 0) {
      gizmoBus.screen = null
      return
    }

    const toPx = (v: THREE.Vector3) => {
      tmp.copy(v).project(camera)
      return {
        x: (tmp.x * 0.5 + 0.5) * size.width,
        y: (-tmp.y * 0.5 + 0.5) * size.height,
      }
    }

    const c = toPx(center)
    const r = toPx(tmp.copy(center).addScaledVector(right, hw))
    const u = toPx(tmp.copy(center).addScaledVector(up, hh))

    gizmoBus.screen = {
      cx: c.x,
      cy: c.y,
      rx: r.x - c.x,
      ry: r.y - c.y,
      ux: u.x - c.x,
      uy: u.y - c.y,
    }
  })

  return null
}
