import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useStudio } from '../store'
import { PartEditor } from './PartEditor'
import { LayerEditor } from './LayerEditor'
import { GraphicsPanel } from './GraphicsPanel'

type Detent = 'collapsed' | 'half' | 'full'

/** Pixel height for each detent (full/half are viewport-relative). */
function detentHeight(d: Detent): number {
  if (typeof window === 'undefined') return 128
  const vh = window.innerHeight
  if (d === 'collapsed') return 132
  if (d === 'half') return Math.min(vh * 0.42, 360)
  return Math.min(vh * 0.82, 640)
}

/** Nearest detent to a live pixel height. */
function snapTo(px: number): Detent {
  const c = detentHeight('collapsed')
  const h = detentHeight('half')
  const f = detentHeight('full')
  const dc = Math.abs(px - c)
  const dh = Math.abs(px - h)
  const df = Math.abs(px - f)
  if (dc <= dh && dc <= df) return 'collapsed'
  if (dh <= df) return 'half'
  return 'full'
}

/**
 * Mobile properties sheet — slides up from the bottom, Apple Maps
 * style, with collapsed / half / full snap detents and a draggable
 * handle (pointer-captured, touch-action: none).
 */
export function BottomSheet() {
  const open = useStudio((s) => s.sheetOpen)
  const setSheetOpen = useStudio((s) => s.setSheetOpen)
  const tab = useStudio((s) => s.sheetTab)
  const setSheetTab = useStudio((s) => s.setSheetTab)
  const parts = useStudio((s) => s.parts)
  const selectedPartId = useStudio((s) => s.selectedPartId)
  const selectPart = useStudio((s) => s.selectPart)
  const activePanel = useStudio((s) => s.activePanel)

  const [detent, setDetent] = useState<Detent>('collapsed')
  const [dragHeight, setDragHeight] = useState<number | null>(null)

  /* Keep the store's coarse open flag in sync with the detent, and let
     other callers (chips, part selection) expand the sheet. */
  useEffect(() => {
    setSheetOpen(detent !== 'collapsed')
  }, [detent, setSheetOpen])

  /* Publish the sheet height so the viewer can shrink to the visible
     strip above it — the model reframes and the selected part stays in
     view. Snapped detents only (not live drag) to avoid canvas thrash. */
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sheet-h',
      `${detentHeight(detent)}px`,
    )
    return () => {
      document.documentElement.style.removeProperty('--sheet-h')
    }
  }, [detent])

  useEffect(() => {
    if (open && detent === 'collapsed') setDetent('half')
    if (!open && detent !== 'collapsed') setDetent('collapsed')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const height = dragHeight ?? detentHeight(detent)

  const cycle = () =>
    setDetent((d) => (d === 'collapsed' ? 'half' : d === 'half' ? 'full' : 'collapsed'))

  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = detentHeight(detent)
    let moved = false
    let live = startH

    const onMove = (ev: PointerEvent) => {
      const dy = startY - ev.clientY
      if (Math.abs(dy) > 3) moved = true
      live = Math.max(
        detentHeight('collapsed') - 40,
        Math.min(detentHeight('full') + 40, startH + dy),
      )
      setDragHeight(live)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      setDragHeight(null)
      /* A drag snaps to the nearest detent; a tap (no movement) cycles. */
      if (moved) setDetent(snapTo(live))
      else cycle()
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp, { once: true })
    window.addEventListener('pointercancel', onUp, { once: true })
  }

  return (
    <motion.div
      className="sheet"
      initial={false}
      animate={{ height }}
      transition={
        dragHeight != null
          ? { duration: 0 }
          : { type: 'spring', stiffness: 380, damping: 34 }
      }
    >
      <div
        className="sheet-handle"
        role="button"
        tabIndex={0}
        aria-label="Resize editor"
        onPointerDown={onHandleDown}
        onKeyDown={(e) => e.key === 'Enter' && cycle()}
      >
        <span />
      </div>

      <div className="sheet-tabs">
        <button
          className={`sheet-tab ${tab === 'parts' ? 'is-active' : ''}`}
          onClick={() => {
            setSheetTab('parts')
            if (detent === 'collapsed') setDetent('half')
          }}
        >
          Parts
        </button>
        <button
          className={`sheet-tab ${tab === 'graphics' ? 'is-active' : ''}`}
          onClick={() => {
            setSheetTab('graphics')
            if (detent === 'collapsed') setDetent('half')
          }}
        >
          Graphics
        </button>
      </div>

      {tab === 'parts' ? (
        <>
          <div className="sheet-chips">
            {parts.map((p) => (
              <button
                key={p.id}
                className={`chip part-chip ${p.id === selectedPartId ? 'is-active' : ''}`}
                onClick={() => {
                  selectPart(p.id)
                  if (detent === 'collapsed') setDetent('half')
                }}
              >
                <span className="part-dot" style={{ background: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
          <div className="sheet-body" aria-hidden={detent === 'collapsed'}>
            <PartEditor />
          </div>
        </>
      ) : (
        <div
          className="sheet-body graphics-body"
          aria-hidden={detent === 'collapsed'}
        >
          <GraphicsPanel />
          {activePanel === 'layer' && <LayerEditor />}
        </div>
      )}
    </motion.div>
  )
}
