import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStudio } from '../store'
import { PRODUCTS } from '../products/catalog'
import { CAMERA_PRESETS } from './viewer/cameraPresets'
import { markDesignSaved } from '../persistence'

interface Command {
  id: string
  label: string
  group: string
  run: () => void
}

/** Fuzzy subsequence match — returns true if all chars of q appear in order. */
function fuzzy(label: string, q: string): boolean {
  if (!q) return true
  const l = label.toLowerCase()
  let i = 0
  for (const ch of q.toLowerCase()) {
    i = l.indexOf(ch, i)
    if (i === -1) return false
    i++
  }
  return true
}

/**
 * ⌘K / Ctrl+K command palette: camera views, part selection, product
 * switching, colorway snapshot, exports, and toggles — all searchable.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const productId = useStudio((s) => s.productId)
  const parts = useStudio((s) => s.parts)

  /* Global open shortcut. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const s = useStudio.getState()
    const list: Command[] = []
    if (!productId) return list

    for (const p of CAMERA_PRESETS) {
      list.push({
        id: `view-${p.id}`,
        label: `View: ${p.label}`,
        group: 'Camera',
        run: () => s.setCameraPreset(p.id),
      })
    }
    for (const part of parts) {
      list.push({
        id: `part-${part.id}`,
        label: `Select part: ${part.label}`,
        group: 'Parts',
        run: () => {
          s.selectPart(part.id)
          s.setSheetOpen(true)
        },
      })
    }
    list.push(
      {
        id: 'add-text',
        label: 'Add text',
        group: 'Design',
        run: () =>
          s.addTextLayer({ content: 'Your text', font: 'sans', weight: 700, color: '#18181B' }),
      },
      {
        id: 'snapshot',
        label: 'Snapshot colorway',
        group: 'Design',
        run: () => {
          s.addColorway()
          s.toast('Colorway snapshot added')
        },
      },
      {
        id: 'techpack',
        label: 'Open Tech Pack',
        group: 'Design',
        run: () => s.setTechPackOpen(true),
      },
      {
        id: 'undo',
        label: 'Undo',
        group: 'Edit',
        run: () => s.undo(),
      },
      {
        id: 'redo',
        label: 'Redo',
        group: 'Edit',
        run: () => s.redo(),
      },
      {
        id: 'reset',
        label: 'Reset design',
        group: 'Edit',
        run: () => {
          s.resetParts()
          s.toast('Design reset')
        },
      },
      {
        id: 'auto-rotate',
        label: 'Toggle auto-rotate',
        group: 'View',
        run: () => s.setAutoRotate(!s.autoRotate),
      },
      {
        id: 'export-png',
        label: 'Export: current view (PNG)',
        group: 'Export',
        run: () => s.exportFn?.({ background: 'studio', size: 2048 }),
      },
      {
        id: 'export-hero',
        label: 'Export: hero pack (ZIP)',
        group: 'Export',
        run: () => s.exportHeroFn?.({ background: 'studio', size: 2048 }),
      },
      {
        id: 'save-json',
        label: 'Save design (JSON)',
        group: 'Export',
        run: () => {
          const cfg = s.serializeDesign()
          if (!cfg) return
          const blob = new Blob([JSON.stringify(cfg, null, 2)], {
            type: 'application/json',
          })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${cfg.productId}-design.json`
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 10_000)
          markDesignSaved()
        },
      },
    )
    for (const p of PRODUCTS) {
      if (p.id === productId) continue
      list.push({
        id: `switch-${p.id}`,
        label: `Switch to ${p.name}`,
        group: 'Product',
        run: () => s.openProduct(p.id),
      })
    }
    return list
  }, [productId, parts])

  const filtered = useMemo(
    () => commands.filter((c) => fuzzy(c.label, query)),
    [commands, query],
  )

  const run = (cmd: Command | undefined) => {
    if (!cmd) return
    cmd.run()
    setOpen(false)
  }

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
            className="palette"
            role="dialog"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              className="palette-input"
              placeholder="Type a command… (colors, views, export)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => Math.min(a + 1, filtered.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => Math.max(a - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  run(filtered[active])
                } else if (e.key === 'Escape') {
                  setOpen(false)
                }
              }}
            />
            <div className="palette-list">
              {filtered.length === 0 && (
                <p className="palette-empty">No matching commands</p>
              )}
              {filtered.map((c, i) => (
                <button
                  key={c.id}
                  className={`palette-item ${i === active ? 'is-active' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => run(c)}
                >
                  <span>{c.label}</span>
                  <span className="palette-group">{c.group}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
