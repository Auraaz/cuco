import { useStudio } from '../store'
import { CAMERA_PRESETS } from './viewer/cameraPresets'

/** Floating segmented control for animated camera presets. */
export function CameraBar() {
  const preset = useStudio((s) => s.cameraPreset)
  const setCameraPreset = useStudio((s) => s.setCameraPreset)

  return (
    <div className="camera-bar" role="tablist" aria-label="Camera presets">
      {CAMERA_PRESETS.map((p) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={preset === p.id}
          className={`camera-chip ${preset === p.id ? 'is-active' : ''}`}
          onClick={() => setCameraPreset(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
