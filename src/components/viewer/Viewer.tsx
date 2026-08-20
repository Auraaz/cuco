import { Suspense, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { useStudio } from '../../store'
import type { ProductDef } from '../../types'
import { isWebGLAvailable } from '../../utils/webgl'
import { ProductModel } from './ProductModel'
import { ModelBoundary } from './ModelBoundary'
import { CameraRig } from './CameraRig'
import { ExportBridge } from './ExportBridge'

/** Studio lighting built from Lightformers — no network HDR fetch. */
function StudioEnvironment() {
  return (
    <>
      <Environment resolution={384}>
        {/* Key */}
        <Lightformer
          intensity={2.8}
          position={[4, 4, 3]}
          rotation-y={Math.PI / 4}
          scale={[5, 4, 1]}
        />
        {/* Fill */}
        <Lightformer
          intensity={1.1}
          position={[-5, 2, -1]}
          rotation-y={-Math.PI / 3}
          scale={[4, 3, 1]}
        />
        {/* Rim */}
        <Lightformer
          intensity={1.8}
          position={[0, 3, -5]}
          rotation-y={Math.PI}
          scale={[6, 2, 1]}
        />
        {/* Soft top strip */}
        <Lightformer
          form="ring"
          intensity={1.1}
          position={[0, 6, 0]}
          rotation-x={-Math.PI / 2}
          scale={[8, 8, 1]}
        />
        {/* Warm bounce from below for material depth */}
        <Lightformer
          intensity={0.5}
          color="#fff2e6"
          position={[0, -3, 2]}
          rotation-x={Math.PI / 2}
          scale={[6, 6, 1]}
        />
      </Environment>
      <directionalLight position={[4, 6, 4]} intensity={0.6} />
      <ambientLight intensity={0.22} />
    </>
  )
}

/**
 * Requests a render whenever visual state changes, so the scene stays
 * correct under frameloop="demand" (which otherwise only renders on
 * pointer input / control changes).
 */
function FrameInvalidator() {
  const invalidate = useThree((s) => s.invalidate)
  const parts = useStudio((s) => s.parts)
  const layers = useStudio((s) => s.layers)
  const selectedLayerId = useStudio((s) => s.selectedLayerId)
  const activePanel = useStudio((s) => s.activePanel)
  useEffect(() => {
    invalidate()
  }, [parts, layers, selectedLayerId, activePanel, invalidate])
  return null
}

export function Viewer({ product }: { product: ProductDef }) {
  const autoRotate = useStudio((s) => s.autoRotate)
  const [webgl] = useState(isWebGLAvailable)

  /* Re-bake the contact shadow only when the silhouette changes (product
     or a part's visibility) — not every frame. Keying ContactShadows on
     this remounts it so it bakes once per change, keeping auto-rotate and
     interactions cheap under frameloop="demand". */
  const shadowKey = useStudio(
    (s) =>
      `${s.productId ?? ''}|${s.parts.filter((p) => !p.visible).map((p) => p.meshName).join(',')}`,
  )

  if (!webgl) {
    return (
      <div className="webgl-fallback" role="alert">
        <h2>3D preview unavailable</h2>
        <p>
          Your browser or device doesn't support WebGL, which StudioERP Article
          Creator needs to render the 3D view. Try a different browser, enable hardware
          acceleration, or update your graphics drivers.
        </p>
      </div>
    )
  }

  return (
    <Canvas
      shadows
      role="img"
      aria-label="Interactive 3D preview of the product. Drag to orbit, scroll to zoom, double-click to focus."
      /* Render on demand to save GPU/battery; stay continuous only while
         auto-rotating. Interactions and state changes invalidate frames. */
      frameloop={autoRotate ? 'always' : 'demand'}
      dpr={[1, 2]}
      camera={{ position: [4.6, 2.5, 5.6], fov: 35 }}
      gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
      style={{ touchAction: 'none' }}
    >
      <Suspense fallback={null}>
        <StudioEnvironment />
        <ModelBoundary>
          <ProductModel product={product} />
        </ModelBoundary>
        <ContactShadows
          key={shadowKey}
          position={[0, -1.78, 0]}
          opacity={0.36}
          scale={10}
          blur={2.4}
          far={3.4}
          resolution={512}
          frames={1}
        />
        <CameraRig />
        <ExportBridge />
        <FrameInvalidator />
      </Suspense>
    </Canvas>
  )
}
