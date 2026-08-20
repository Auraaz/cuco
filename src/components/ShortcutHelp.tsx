import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: '⌘K / Ctrl K', label: 'Command palette' },
  { keys: 'Ctrl Z', label: 'Undo' },
  { keys: 'Ctrl ⇧ Z', label: 'Redo' },
  { keys: 'Ctrl D', label: 'Duplicate selected artwork' },
  { keys: 'Delete', label: 'Remove selected artwork' },
  { keys: '← ↑ ↓ →', label: 'Nudge artwork (⇧ = larger)' },
  { keys: 'Space', label: 'Toggle auto-rotate' },
  { keys: 'F', label: 'Reframe (hero view)' },
  { keys: '?', label: 'This help' },
]

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

/** Keyboard-shortcut reference, opened with "?". */
export function ShortcutHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !isEditable(e.target)) {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onPointerDown={() => setOpen(false)}
        >
          <motion.div
            className="shortcut-help"
            role="dialog"
            aria-label="Keyboard shortcuts"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <h3>Keyboard shortcuts</h3>
            <dl>
              {SHORTCUTS.map((s) => (
                <div key={s.label} className="shortcut-row">
                  <dt>{s.label}</dt>
                  <dd>
                    <kbd>{s.keys}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
