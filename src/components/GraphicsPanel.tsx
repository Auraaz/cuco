import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useStudio } from '../store'
import { Eye, EyeOff } from './Icons'

/** Read an uploaded image file as a data URL. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Measure an image's aspect ratio (width / height) from a data URL. */
function measureAspect(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () =>
      resolve(img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1)
    img.onerror = () => resolve(1)
    img.src = dataUrl
  })
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml'

/** Artwork upload + layer list. */
export function GraphicsPanel() {
  const layers = useStudio((s) => s.layers)
  const selectedLayerId = useStudio((s) => s.selectedLayerId)
  const selectLayer = useStudio((s) => s.selectLayer)
  const updateLayer = useStudio((s) => s.updateLayer)
  const addLayer = useStudio((s) => s.addLayer)
  const addTextLayer = useStudio((s) => s.addTextLayer)
  const setSheetOpen = useStudio((s) => s.setSheetOpen)
  const toast = useStudio((s) => s.toast)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    let failed = 0
    for (const file of files) {
      const tooBig = file.size > 12 * 1024 * 1024
      if (tooBig) {
        failed++
        continue
      }
      try {
        const url = await readAsDataUrl(file)
        const aspect = await measureAspect(url)
        addLayer(url, file.name.replace(/\.[^.]+$/, ''), aspect)
      } catch {
        failed++
      }
    }
    e.target.value = ''
    if (failed > 0) {
      toast(
        failed === files.length
          ? "Couldn't add that artwork — use a PNG, JPEG, WebP or SVG under 12 MB"
          : `${failed} file${failed > 1 ? 's' : ''} skipped (unsupported or too large)`,
      )
    }
  }

  const addText = () => {
    addTextLayer({ content: 'Your text', font: 'sans', weight: 700, color: '#18181B' })
    setSheetOpen(true)
  }

  return (
    <div className="graphics">
      <div className="graphics-actions">
        <button className="upload-btn" onClick={() => fileRef.current?.click()}>
          + Add artwork
        </button>
        <button className="upload-btn" onClick={addText}>
          + Add text
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={onFiles}
      />

      {layers.length === 0 ? (
        <p className="editor-empty small">
          PNG, JPEG, WebP or SVG. Transparent backgrounds supported.
        </p>
      ) : (
        <div className="parts-list">
          {[...layers].reverse().map((l) => (
            <div
              key={l.id}
              className={`part-row ${l.id === selectedLayerId ? 'is-selected' : ''} ${
                l.visible ? '' : 'is-hidden'
              }`}
              onClick={() => {
                selectLayer(l.id)
                setSheetOpen(true)
              }}
            >
              <img className="layer-thumb" src={l.image} alt="" />
              <span className="part-label">{l.name}</span>
              <button
                className="icon-btn part-eye"
                aria-label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  updateLayer(l.id, { visible: !l.visible })
                }}
              >
                {l.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
