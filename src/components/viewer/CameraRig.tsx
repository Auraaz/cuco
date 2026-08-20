import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStudio } from '../../store'
import { cameraPresetById } from './cameraPresets'

/**
 * Damped orbit controls + animated fly-to for camera presets.
 * User interaction cancels the preset (and its animation).
 */
export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const preset = useStudio((s) => s.cameraPreset)
  const nonce = useStudio((s) => s.cameraNonce)
  const focus = useStudio((s) => s.cameraFocus)
  const autoRotate = useStudio((s) => s.autoRotate)

  const animating = useRef(false)
  const toPos = useRef(new THREE.Vector3())
  const toLook = useRef(new THREE.Vector3())

  useEffect(() => {
    if (!preset) return
    const def = cameraPresetById(preset)
    if (!def) return
    /* On narrow (portrait) viewports, pull the camera back so the
       model still fits the horizontal field of view. */
    const aspect = size.width / Math.max(size.height, 1)
    const fit = aspect >= 1 ? 1 : Math.min(1.8, 1 / Math.max(aspect, 0.4))
    toPos.current.set(...def.position).multiplyScalar(fit)
    toLook.current.set(...def.target)
    animating.current = true
    /* Kick a frame so the fly-to runs under frameloop="demand". */
    invalidate()
  }, [preset, nonce, size, invalidate])

  /* Double-click focus: zoom toward a point on the model, keeping the
     current viewing direction. */
  useEffect(() => {
    if (!focus) return
    const target = new THREE.Vector3(...focus.target)
    const dir = camera.position.clone().sub(toLook.current).normalize()
    if (dir.lengthSq() < 1e-6) dir.set(0.6, 0.35, 0.72).normalize()
    toLook.current.copy(target)
    toPos.current.copy(target).addScaledVector(dir, 3.4)
    animating.current = true
    invalidate()
  }, [focus, camera, invalidate])

  useFrame((_, delta) => {
    const c = controls.current
    if (!animating.current || !c) return
    const k = 1 - Math.pow(0.0005, delta)
    camera.position.lerp(toPos.current, k)
    c.target.lerp(toLook.current, k)
    c.update()
    if (
      camera.position.distanceTo(toPos.current) < 0.008 &&
      c.target.distanceTo(toLook.current) < 0.008
    ) {
      camera.position.copy(toPos.current)
      c.target.copy(toLook.current)
      c.update()
      animating.current = false
    } else {
      /* Keep requesting frames until the animation settles. */
      invalidate()
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.9}
      minDistance={2.4}
      maxDistance={16}
      minPolarAngle={Math.PI * 0.06}
      maxPolarAngle={Math.PI * 0.82}
      autoRotate={autoRotate}
      autoRotateSpeed={1.5}
      onStart={() => {
        if (animating.current) animating.current = false
        useStudio.getState().setCameraPreset(null)
      }}
    />
  )
}
