import { AnimatePresence, motion } from 'framer-motion'
import { useStudio } from '../store'

/**
 * Full-screen overlay shown while a remote model downloads. Shows a
 * determinate percentage bar when the server reports content-length, or an
 * indeterminate sweep otherwise.
 */
export function LoadingOverlay() {
  const progress = useStudio((s) => s.loadProgress)
  const pct =
    progress && progress.ratio != null ? Math.round(progress.ratio * 100) : null

  return (
    <AnimatePresence>
      {progress && (
        <motion.div
          className="model-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="status"
          aria-live="polite"
        >
          <div className="model-loading-card">
            <div className="model-loading-emoji" aria-hidden>
              📦
            </div>
            <strong>{progress.label}</strong>
            <div className={`load-bar ${pct == null ? 'indeterminate' : ''}`}>
              <span style={pct == null ? undefined : { width: `${pct}%` }} />
            </div>
            <span className="load-pct">{pct == null ? 'Loading…' : `${pct}%`}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
