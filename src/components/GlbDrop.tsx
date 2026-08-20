import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStudio } from '../store'
import { loadCustomGlb, productById } from '../products/catalog'
import type { DesignConfig } from '../types'

const isModel = (name: string) => /\.(glb|gltf|usdz|usda|usdc|usd)$/i.test(name)
const isDesign = (name: string) => /\.json$/i.test(name)

/** Load a dropped/selected model file into the configurator. */
export function openModelFile(file: File) {
  const def = loadCustomGlb(file)
  useStudio.getState().openProduct(def.id)
  useStudio.getState().toast(`Loaded ${def.name}`)
}

function openDesignFile(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const cfg = JSON.parse(String(reader.result)) as DesignConfig
      if (cfg.app === 'apparel-studio' && productById(cfg.productId)) {
        useStudio.getState().openDesign(cfg)
      } else {
        useStudio.getState().toast("That design references a model that isn't loaded.")
      }
    } catch {
      useStudio.getState().toast("Couldn't read that file.")
    }
  }
  reader.readAsText(file)
}

/**
 * Whole-window drag-and-drop: drop a .glb/.gltf anywhere to open it in the
 * configurator (or a saved .json design to restore it). Shows a full-screen
 * hint while a file is dragged over the app.
 */
export function GlbDrop() {
  const [over, setOver] = useState(false)
  const depth = useRef(0)

  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current += 1
      setOver(true)
    }
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current -= 1
      if (depth.current <= 0) {
        depth.current = 0
        setOver(false)
      }
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setOver(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      const model = files.find((f) => isModel(f.name))
      if (model) {
        openModelFile(model)
        return
      }
      const design = files.find((f) => isDesign(f.name))
      if (design) {
        openDesignFile(design)
        return
      }
      useStudio.getState().toast('Drop a .glb, .gltf or .usdz 3D model.')
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <AnimatePresence>
      {over && (
        <motion.div
          className="glb-drop-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <div className="glb-drop-card">
            <div className="glb-drop-emoji" aria-hidden>
              📦
            </div>
            <strong>Drop to load 3D model</strong>
            <span>.glb, .gltf or .usdz — it opens straight in the configurator</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
