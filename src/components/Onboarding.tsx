import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const SEEN_KEY = 'apparel-studio:onboarded:v1'

function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

/**
 * One-time coach hint shown the first time a product is opened. Explains
 * the two non-obvious interactions: tapping a part to recolor it and
 * dragging artwork directly on the model.
 */
export function Onboarding() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!hasSeen()) {
      const t = window.setTimeout(() => setShow(true), 650)
      return () => window.clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="coach"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          role="dialog"
          aria-label="Getting started"
        >
          <div className="coach-hand" aria-hidden>
            <motion.span
              animate={{ x: [0, 22, -14, 0], y: [0, -8, 10, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              👆
            </motion.span>
          </div>
          <h3>Two ways to design</h3>
          <ul>
            <li>
              <strong>Tap a part</strong> on the model (or in the list) to
              recolor it and change its material.
            </li>
            <li>
              <strong>Add artwork</strong>, then drag it right on the garment —
              corners scale, the top handle rotates.
            </li>
          </ul>
          <button className="primary-btn full" onClick={dismiss}>
            Got it
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
