import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStudio } from './store'
import { productById } from './products/catalog'
import { ChevronLeft as ChevLeft, ChevronRight, Minimize } from './components/Icons'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { ProductPicker } from './components/ProductPicker'
import { TopNav } from './components/TopNav'
import { Viewer } from './components/viewer/Viewer'
import { PartsPanel } from './components/PartsPanel'
import { PartEditor } from './components/PartEditor'
import { GraphicsPanel } from './components/GraphicsPanel'
import { LayerEditor } from './components/LayerEditor'
import { CameraBar } from './components/CameraBar'
import { BottomSheet } from './components/BottomSheet'
import { TechPack } from './components/TechPack'
import { AutoVariants } from './components/AutoVariants'
import { DecalGizmo } from './components/DecalGizmo'
import { Toast } from './components/Toast'
import { Onboarding } from './components/Onboarding'
import { CommandPalette } from './components/CommandPalette'
import { ShortcutHelp } from './components/ShortcutHelp'
import { GlbDrop } from './components/GlbDrop'
import { LoadingOverlay } from './components/LoadingOverlay'
import { ConsumerCatalog } from './components/ConsumerCatalog'
import { ConsumerStudio } from './components/ConsumerStudio'
import { Cart } from './components/Cart'

/** Boolean UI preference persisted to localStorage (survives reloads). */
function usePersistentFlag(key: string, initial = false) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : raw === '1'
    } catch {
      return initial
    }
  })
  const set = (next: boolean) => {
    setValue(next)
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
  return [value, set] as const
}

export default function App() {
  const role = useStudio((s) => s.role)
  const productId = useStudio((s) => s.productId)
  const activePanel = useStudio((s) => s.activePanel)
  const product = productId ? productById(productId) : undefined

  const [leftMin, setLeftMin] = usePersistentFlag('apparel-studio:panel-left:min')
  const [rightMin, setRightMin] = usePersistentFlag('apparel-studio:panel-right:min')

  useKeyboardShortcuts()

  /* Consumer experience: browse the catalog, then customize one article via
     only the options the designer exposed. No authoring chrome, no GLB drop. */
  if (role === 'consumer') {
    return (
      <>
        <LoadingOverlay />
        <AnimatePresence mode="wait">
          {!product ? (
            <ConsumerCatalog key="catalog" />
          ) : (
            <ConsumerStudio key={product.id} product={product} />
          )}
        </AnimatePresence>
        <Cart />
        <Toast />
      </>
    )
  }

  return (
    <>
      <GlbDrop />
      <LoadingOverlay />
      <AnimatePresence mode="wait">
      {!product ? (
        <motion.main
          key="picker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <ProductPicker />
        </motion.main>
      ) : (
        <motion.main
          key={product.id}
          className="studio"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <TopNav />

          <div className="viewer-wrap">
            <Viewer product={product} />
            <DecalGizmo />
            <CameraBar />
          </div>

          {/* Desktop floating panels (collapsible) */}
          {leftMin ? (
            <button
              className="panel-restore left"
              onClick={() => setLeftMin(false)}
              aria-label="Show parts panel"
              title="Show parts"
            >
              <ChevronRight size={16} />
              <span>Parts</span>
            </button>
          ) : (
            <aside className="panel panel-left" aria-label="Parts">
              <div className="panel-head">
                <h4 className="panel-title flush">Parts</h4>
                <button
                  className="icon-btn panel-min"
                  onClick={() => setLeftMin(true)}
                  aria-label="Minimize parts panel"
                  title="Minimize"
                >
                  <Minimize size={18} />
                </button>
              </div>
              <PartsPanel />
            </aside>
          )}

          {rightMin ? (
            <button
              className="panel-restore right"
              onClick={() => setRightMin(false)}
              aria-label="Show properties panel"
              title="Show properties"
            >
              <span>Properties</span>
              <ChevLeft size={16} />
            </button>
          ) : (
            <aside className="panel panel-right" aria-label="Graphics and properties">
              <div className="panel-head">
                <h4 className="panel-title flush">Properties</h4>
                <button
                  className="icon-btn panel-min"
                  onClick={() => setRightMin(true)}
                  aria-label="Minimize properties panel"
                  title="Minimize"
                >
                  <Minimize size={18} />
                </button>
              </div>
              <h4 className="panel-title">Graphics</h4>
              <GraphicsPanel />
              <div className="panel-divider" />
              {activePanel === 'layer' ? <LayerEditor /> : <PartEditor />}
            </aside>
          )}

          {/* Mobile bottom sheet */}
          <BottomSheet />

          {/* Tech pack overlay */}
          <TechPack />

          {/* Auto-variant generator */}
          <AutoVariants />

          <Onboarding />
          <Toast />
          <CommandPalette />
          <ShortcutHelp />
        </motion.main>
      )}
      </AnimatePresence>
    </>
  )
}
