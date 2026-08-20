import { AnimatePresence, motion } from 'framer-motion'
import { useStudio } from '../store'

/** Transient status pill (e.g. "Design reset", "Design saved"). */
export function Toast() {
  const msg = useStudio((s) => s.toastMsg)
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          className="toast"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
