import { useEffect, useRef } from 'react'
import { useStudio } from '../store'
import { gizmoBus } from './viewer/gizmoBus'

const MIN_SCALE = 0.06
const MAX_SCALE = 1.6

type Drag =
  | { kind: 'scale'; startDist: number; startScale: number }
  | { kind: 'rotate'; startAngle: number; startSpin: number }
  | null

/**
 * Screen-space transform box drawn over the selected decal. Corner
 * handles scale, the top handle rotates. The box body has no pointer
 * events, so tapping the artwork itself passes through to the 3D view
 * for move-dragging. Positioned imperatively from gizmoBus each frame.
 */
export function DecalGizmo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag>(null)
  const layerId = useRef<string | null>(null)

  const selectedLayerId = useStudio((s) => s.selectedLayerId)
  const activePanel = useStudio((s) => s.activePanel)
  layerId.current = activePanel === 'layer' ? selectedLayerId : null

  const withLayer = (fn: (l: import('../types').DecalLayer) => void) => {
    const id = layerId.current
    if (!id) return
    const l = useStudio.getState().layers.find((x) => x.id === id)
    if (l) fn(l)
  }
  const bump = (d: number) =>
    withLayer((l) =>
      useStudio.getState().updateLayer(l.id, {
        scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, l.scale + d)),
      }),
    )
  const spinBy = (rad: number) =>
    withLayer((l) => useStudio.getState().updateLayer(l.id, { spin: l.spin + rad }))
  const flip = () =>
    withLayer((l) => useStudio.getState().updateLayer(l.id, { flipX: !l.flipX }))
  const dupe = () => withLayer((l) => useStudio.getState().duplicateLayer(l.id))
  const del = () => withLayer((l) => useStudio.getState().removeLayer(l.id))

  /* Position the box from the projected screen frame every animation
     frame — no React state churn. */
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const box = boxRef.current
      if (!box) return
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        gizmoCanvasOffset.x = rect.left
        gizmoCanvasOffset.y = rect.top
      }
      const bar = barRef.current
      const g = gizmoBus.screen
      if (!g || !layerId.current) {
        box.style.display = 'none'
        if (bar) bar.style.display = 'none'
        return
      }
      const halfW = Math.hypot(g.rx, g.ry)
      const halfH = Math.hypot(g.ux, g.uy)
      /* Box "width" axis is the decal's right axis in screen space. */
      const angle = (Math.atan2(g.ry, g.rx) * 180) / Math.PI
      box.style.display = 'block'
      box.style.width = `${Math.max(halfW * 2, 24)}px`
      box.style.height = `${Math.max(halfH * 2, 24)}px`
      box.style.transform = `translate(${g.cx}px, ${g.cy}px) translate(-50%, -50%) rotate(${angle}deg)`

      /* Un-rotated toolbar below the box. */
      if (bar) {
        const below = g.cy + Math.max(halfH, halfW) + 26
        bar.style.display = 'flex'
        bar.style.transform = `translate(${g.cx}px, ${below}px) translate(-50%, 0)`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  /* Global pointer handlers while a handle is being dragged. */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      const g = gizmoBus.screen
      const id = layerId.current
      if (!d || !g || !id) return
      e.preventDefault()
      const dx = e.clientX - gizmoCanvasOffset.x - g.cx
      const dy = e.clientY - gizmoCanvasOffset.y - g.cy
      if (d.kind === 'scale') {
        const dist = Math.hypot(dx, dy)
        const ratio = d.startDist > 0 ? dist / d.startDist : 1
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, d.startScale * ratio))
        useStudio.getState().updateLayer(id, { scale: next })
      } else {
        const angle = Math.atan2(dy, dx)
        const delta = angle - d.startAngle
        useStudio.getState().updateLayer(id, { spin: d.startSpin + delta })
      }
    }
    const onUp = () => {
      drag.current = null
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const startScale = (e: React.PointerEvent) => {
    e.stopPropagation()
    const g = gizmoBus.screen
    const id = layerId.current
    if (!g || !id) return
    const layer = useStudio.getState().layers.find((l) => l.id === id)
    if (!layer) return
    const dx = e.clientX - gizmoCanvasOffset.x - g.cx
    const dy = e.clientY - gizmoCanvasOffset.y - g.cy
    drag.current = {
      kind: 'scale',
      startDist: Math.hypot(dx, dy),
      startScale: layer.scale,
    }
  }

  const startRotate = (e: React.PointerEvent) => {
    e.stopPropagation()
    const g = gizmoBus.screen
    const id = layerId.current
    if (!g || !id) return
    const layer = useStudio.getState().layers.find((l) => l.id === id)
    if (!layer) return
    const dx = e.clientX - gizmoCanvasOffset.x - g.cx
    const dy = e.clientY - gizmoCanvasOffset.y - g.cy
    drag.current = {
      kind: 'rotate',
      startAngle: Math.atan2(dy, dx),
      startSpin: layer.spin,
    }
  }

  return (
    <div className="gizmo-layer" aria-hidden ref={containerRef}>
      <div ref={boxRef} className="gizmo-box">
        <span className="gizmo-edge" />
        <button type="button" tabIndex={-1} aria-label="Scale artwork" className="gizmo-handle corner tl" onPointerDown={startScale} />
        <button type="button" tabIndex={-1} aria-label="Scale artwork" className="gizmo-handle corner tr" onPointerDown={startScale} />
        <button type="button" tabIndex={-1} aria-label="Scale artwork" className="gizmo-handle corner br" onPointerDown={startScale} />
        <button type="button" tabIndex={-1} aria-label="Scale artwork" className="gizmo-handle corner bl" onPointerDown={startScale} />
        <span className="gizmo-stem" />
        <button type="button" tabIndex={-1} aria-label="Rotate artwork" className="gizmo-handle rotate" onPointerDown={startRotate} />
      </div>

      <div ref={barRef} className="mini-toolbar">
        <button type="button" tabIndex={-1} className="mini-btn" title="Smaller" aria-label="Make artwork smaller" onClick={() => bump(-0.06)}>
          A−
        </button>
        <button type="button" tabIndex={-1} className="mini-btn" title="Bigger" aria-label="Make artwork bigger" onClick={() => bump(0.06)}>
          A+
        </button>
        <button type="button" tabIndex={-1} className="mini-btn" title="Rotate" aria-label="Rotate artwork" onClick={() => spinBy(Math.PI / 12)}>
          ⟳
        </button>
        <button type="button" tabIndex={-1} className="mini-btn" title="Flip" aria-label="Flip artwork" onClick={flip}>
          ⇋
        </button>
        <button type="button" tabIndex={-1} className="mini-btn" title="Duplicate" aria-label="Duplicate artwork" onClick={dupe}>
          ⧉
        </button>
        <button type="button" tabIndex={-1} className="mini-btn danger" title="Delete" aria-label="Delete artwork" onClick={del}>
          ✕
        </button>
      </div>
    </div>
  )
}

/**
 * The canvas' top-left offset in client coords. gizmoBus screen coords
 * are relative to the canvas, but pointer events are in client space, so
 * we subtract this. Updated by the overlay's container ref.
 */
export const gizmoCanvasOffset = { x: 0, y: 0 }
