import { useEffect } from 'react'
import { useStudio } from '../store'

const isEditableTarget = (t: EventTarget | null) => {
  if (!(t instanceof HTMLElement)) return false
  if (t.tagName === 'TEXTAREA' || t.isContentEditable) return true
  if (t instanceof HTMLInputElement) {
    /* Sliders, checkboxes and color wells shouldn't swallow shortcuts. */
    return ['text', 'search', 'number', 'email', 'url', 'password'].includes(
      t.type,
    )
  }
  return false
}

/**
 * Global shortcuts:
 *   Ctrl/Cmd+Z            undo
 *   Ctrl/Cmd+Shift+Z / Y  redo
 *   Delete / Backspace    remove selected artwork layer
 *   Space                 toggle auto-rotate
 *   F                     reframe (hero preset)
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStudio.getState()
      if (!s.productId || isEditableTarget(e.target)) return

      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'd' && s.selectedLayerId) {
        e.preventDefault()
        s.duplicateLayer(s.selectedLayerId)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedLayerId) {
        e.preventDefault()
        s.removeLayer(s.selectedLayerId)
        return
      }
      /* Arrow keys nudge the selected artwork layer — unless a control
         (slider, input) has focus and should keep its arrow behavior. */
      if (
        s.activePanel === 'layer' &&
        s.selectedLayerId &&
        !(e.target instanceof HTMLInputElement) &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault()
        const step = e.shiftKey ? 0.15 : 0.04
        const [dx, dy] =
          e.key === 'ArrowUp'
            ? [0, step]
            : e.key === 'ArrowDown'
              ? [0, -step]
              : e.key === 'ArrowLeft'
                ? [-step, 0]
                : [step, 0]
        s.nudgeLayer(s.selectedLayerId, dx, dy)
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        s.setAutoRotate(!s.autoRotate)
        return
      }
      if (e.key.toLowerCase() === 'f' && !mod) {
        e.preventDefault()
        s.setCameraPreset('perspective')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
