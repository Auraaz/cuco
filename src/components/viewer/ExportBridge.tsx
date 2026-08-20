import { useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { createZip, dataUrlToBytes } from '../../utils/zip'
import type { ZipEntry } from '../../utils/zip'
import { useStudio } from '../../store'
import type { ExportOptions } from '../../types'

const HERO_VIEWS: { name: string; position: [number, number, number]; target: [number, number, number] }[] = [
  { name: '1-front', position: [0, 0.5, 7.6], target: [0, 0.1, 0] },
  { name: '2-back', position: [0, 0.5, -7.6], target: [0, 0.1, 0] },
  { name: '3-left', position: [-7.6, 0.5, 0], target: [0, 0.1, 0] },
  { name: '4-right', position: [7.6, 0.5, 0], target: [0, 0.1, 0] },
  { name: '5-hero', position: [4.6, 2.5, 5.6], target: [0, 0.1, 0] },
  { name: '6-detail', position: [1.7, 1.15, 2.6], target: [0, 0.55, 0] },
]

function download(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

/**
 * Registers imperative export functions in the store: a single
 * current-view PNG, and the 6-view hero pack (ZIP). Both render at
 * export resolution, capture, then restore the live view.
 */
export function ExportBridge() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const setExportFn = useStudio((s) => s.setExportFn)
  const setExportHeroFn = useStudio((s) => s.setExportHeroFn)
  const setCaptureFn = useStudio((s) => s.setCaptureFn)

  useEffect(() => {
    const applyBackground = (background: ExportOptions['background']) => {
      if (background === 'transparent') {
        scene.background = null
        gl.setClearAlpha(0)
      } else if (background === 'white') {
        scene.background = new THREE.Color('#FFFFFF')
      } else {
        scene.background = new THREE.Color('#F4F4F6')
      }
    }

    const exportPng = async ({ background, size: px }: ExportOptions) => {
      const prevRatio = gl.getPixelRatio()
      const prevBg = scene.background
      const prevAlpha = gl.getClearAlpha()

      gl.setPixelRatio(px / Math.max(size.width, size.height))
      applyBackground(background)
      gl.render(scene, camera)
      const url = gl.domElement.toDataURL('image/png')

      gl.setPixelRatio(prevRatio)
      scene.background = prevBg
      gl.setClearAlpha(prevAlpha)
      gl.render(scene, camera)

      const productId = useStudio.getState().productId ?? 'render'
      download(url, `${productId}-${background}-${px}px.png`)
    }

    const exportHeroPack = async ({ background, size: px }: ExportOptions) => {
      const prevBg = scene.background
      const prevAlpha = gl.getClearAlpha()
      const prevSize = new THREE.Vector2()
      gl.getSize(prevSize)
      const prevRatio = gl.getPixelRatio()

      const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
      const entries: ZipEntry[] = []

      gl.setPixelRatio(1)
      gl.setSize(px, px, false)
      applyBackground(background)

      for (const view of HERO_VIEWS) {
        cam.position.set(...view.position)
        cam.lookAt(...view.target)
        cam.updateProjectionMatrix()
        gl.render(scene, cam)
        const dataUrl = gl.domElement.toDataURL('image/png')
        entries.push({ name: `${view.name}.png`, data: dataUrlToBytes(dataUrl) })
        /* Yield so the UI can breathe between heavy frames. */
        await new Promise((r) => setTimeout(r, 0))
      }

      gl.setPixelRatio(prevRatio)
      gl.setSize(prevSize.x, prevSize.y, false)
      scene.background = prevBg
      gl.setClearAlpha(prevAlpha)
      gl.render(scene, camera)

      const blob = createZip(entries)
      const url = URL.createObjectURL(blob)
      const productId = useStudio.getState().productId ?? 'design'
      download(url, `${productId}-hero-pack-${background}.zip`)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }

    /** Square hero-view render used for colorway thumbnails. */
    const capture = async (px: number): Promise<string> => {
      const prevBg = scene.background
      const prevAlpha = gl.getClearAlpha()
      const prevSize = new THREE.Vector2()
      gl.getSize(prevSize)
      const prevRatio = gl.getPixelRatio()

      const hero = HERO_VIEWS.find((v) => v.name === '5-hero')!
      const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
      cam.position.set(...hero.position)
      cam.lookAt(...hero.target)
      cam.updateProjectionMatrix()

      gl.setPixelRatio(1)
      gl.setSize(px, px, false)
      applyBackground('studio')
      gl.render(scene, cam)
      const dataUrl = gl.domElement.toDataURL('image/png')

      gl.setPixelRatio(prevRatio)
      gl.setSize(prevSize.x, prevSize.y, false)
      scene.background = prevBg
      gl.setClearAlpha(prevAlpha)
      gl.render(scene, camera)
      return dataUrl
    }

    setExportFn(exportPng)
    setExportHeroFn(exportHeroPack)
    setCaptureFn(capture)
    return () => {
      setExportFn(null)
      setExportHeroFn(null)
      setCaptureFn(null)
    }
  }, [gl, scene, camera, size, setExportFn, setExportHeroFn, setCaptureFn])

  return null
}
