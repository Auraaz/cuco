import { useStudio } from '../store'
import { productById } from '../products/catalog'
import { CURATED_COLORS } from '../store'
import { TEXT_FONTS } from '../utils/textRender'
import { VariableToggle } from './VariableToggle'
import type { TextSpec } from '../types'

/** Editing controls for the selected artwork layer. */
export function LayerEditor() {
  const layer = useStudio((s) =>
    s.layers.find((l) => l.id === s.selectedLayerId),
  )
  const productId = useStudio((s) => s.productId)
  const updateLayer = useStudio((s) => s.updateLayer)
  const updateTextLayer = useStudio((s) => s.updateTextLayer)
  const snapLayerToZone = useStudio((s) => s.snapLayerToZone)
  const removeLayer = useStudio((s) => s.removeLayer)
  const duplicateLayer = useStudio((s) => s.duplicateLayer)
  const moveLayer = useStudio((s) => s.moveLayer)
  const placing = useStudio((s) => s.placing)
  const setPlacing = useStudio((s) => s.setPlacing)
  const nudgeLayer = useStudio((s) => s.nudgeLayer)

  const STEP = 0.06

  const product = productId ? productById(productId) : undefined

  if (!layer || !product) {
    return <p className="editor-empty">Add artwork to start designing.</p>
  }

  const patchText = (patch: Partial<TextSpec>) => {
    if (!layer.text) return
    updateTextLayer(layer.id, { ...layer.text, ...patch })
  }

  return (
    <div className="editor">
      <div className="layer-head">
        <img className="layer-thumb lg" src={layer.image} alt="" />
        <h3 className="editor-title clip">{layer.name}</h3>
      </div>

      {!layer.text && (
        <section className="editor-section">
          <div className="section-head">
            <h4 className="section-label">Artwork</h4>
            <VariableToggle
              type="graphic"
              target={{ kind: 'layerImage', layerId: layer.id }}
              label={`${layer.name} artwork`}
              defaultName={`${layer.name} Graphic`}
            />
          </div>
          <p className="editor-hint">
            As a variable, each spreadsheet row swaps this artwork (by
            filename). An empty cell hides it for that variant.
          </p>
        </section>
      )}

      {layer.text && (
        <section className="editor-section">
          <div className="section-head">
            <h4 className="section-label">Text</h4>
            <VariableToggle
              type="text"
              target={{ kind: 'layerText', layerId: layer.id }}
              label={`${layer.name} text`}
              defaultName="Text"
            />
          </div>
          <textarea
            className="text-input"
            value={layer.text.content}
            rows={2}
            aria-label="Text content"
            onChange={(e) => patchText({ content: e.target.value })}
          />
          <div className="section-head" style={{ marginTop: 10 }}>
            <h4 className="section-label" style={{ margin: 0 }}>
              Font
            </h4>
            <VariableToggle
              type="font"
              target={{ kind: 'layerTextFont', layerId: layer.id }}
              label={`${layer.name} font`}
              defaultName="Font"
            />
          </div>
          <div className="preset-grid" style={{ marginTop: 8 }}>
            {TEXT_FONTS.map((f) => (
              <button
                key={f.id}
                className={`chip ${layer.text!.font === f.id ? 'is-active' : ''}`}
                style={{ fontFamily: f.stack }}
                onClick={() => patchText({ font: f.id })}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="preset-grid" style={{ marginTop: 8 }}>
            <button
              className={`chip ${layer.text.weight < 600 ? 'is-active' : ''}`}
              onClick={() => patchText({ weight: 400 })}
            >
              Regular
            </button>
            <button
              className={`chip ${layer.text.weight >= 600 ? 'is-active' : ''}`}
              onClick={() => patchText({ weight: 800 })}
            >
              Bold
            </button>
          </div>
          <div className="section-head" style={{ marginTop: 12 }}>
            <h4 className="section-label" style={{ margin: 0 }}>
              Color
            </h4>
            <VariableToggle
              type="color"
              target={{ kind: 'layerTextColor', layerId: layer.id }}
              label={`${layer.name} text color`}
              defaultName="Text Color"
            />
          </div>
          <div className="swatch-grid" style={{ marginTop: 8 }}>
            {CURATED_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${
                  layer.text!.color.toUpperCase() === c.toUpperCase() ? 'is-active' : ''
                }`}
                style={{ background: c }}
                aria-label={`Text color ${c}`}
                onClick={() => patchText({ color: c })}
              />
            ))}
          </div>
        </section>
      )}

      <section className="editor-section">
        <div className="section-head">
          <h4 className="section-label">Placement</h4>
          <VariableToggle
            type="placement"
            target={{ kind: 'layerPlacement', layerId: layer.id }}
            label={`${layer.name} placement`}
            defaultName={`${layer.name} Placement`}
          />
        </div>
        <div className="preset-grid">
          {product.zones.map((z) => (
            <button
              key={z.id}
              className={`chip ${layer.zoneId === z.id ? 'is-active' : ''}`}
              onClick={() => snapLayerToZone(layer.id, z.id)}
            >
              {z.label}
            </button>
          ))}
        </div>
        <button
          className={`chip wide ${placing ? 'is-active' : ''}`}
          aria-pressed={placing}
          onClick={() => setPlacing(!placing)}
        >
          {placing ? 'Done positioning' : 'Position by dragging on model'}
        </button>
        <p className="editor-hint">
          Tip: drag the artwork on the garment to move it, the corners to
          scale, and the top handle to rotate.
        </p>

        <div className="nudge-row">
          <span className="nudge-label">Nudge</span>
          <div className="nudge-pad">
            <button
              className="icon-btn nudge up"
              aria-label="Nudge up"
              title="Nudge up (↑)"
              onClick={() => nudgeLayer(layer.id, 0, STEP)}
            >
              ↑
            </button>
            <button
              className="icon-btn nudge left"
              aria-label="Nudge left"
              title="Nudge left (←)"
              onClick={() => nudgeLayer(layer.id, -STEP, 0)}
            >
              ←
            </button>
            <button
              className="icon-btn nudge down"
              aria-label="Nudge down"
              title="Nudge down (↓)"
              onClick={() => nudgeLayer(layer.id, 0, -STEP)}
            >
              ↓
            </button>
            <button
              className="icon-btn nudge right"
              aria-label="Nudge right"
              title="Nudge right (→)"
              onClick={() => nudgeLayer(layer.id, STEP, 0)}
            >
              →
            </button>
          </div>
        </div>
      </section>

      <section className="editor-section">
        <label className="slider-row">
          <span>Size</span>
          <input
            type="range"
            aria-label="Artwork size"
            min={0.08}
            max={1.4}
            step={0.01}
            value={layer.scale}
            onChange={(e) =>
              updateLayer(layer.id, { scale: Number(e.target.value) })
            }
          />
          <output>{layer.scale.toFixed(2)}</output>
        </label>
        <label className="slider-row">
          <span>Rotation</span>
          <input
            type="range"
            aria-label="Artwork rotation in degrees"
            min={-180}
            max={180}
            step={1}
            value={Math.round((layer.spin * 180) / Math.PI)}
            onChange={(e) =>
              updateLayer(layer.id, {
                spin: (Number(e.target.value) * Math.PI) / 180,
              })
            }
          />
          <output>{Math.round((layer.spin * 180) / Math.PI)}°</output>
        </label>
        <label className="slider-row">
          <span>Opacity</span>
          <input
            type="range"
            aria-label="Artwork opacity"
            min={0.05}
            max={1}
            step={0.01}
            value={layer.opacity}
            onChange={(e) =>
              updateLayer(layer.id, { opacity: Number(e.target.value) })
            }
          />
          <output>{Math.round(layer.opacity * 100)}%</output>
        </label>
      </section>

      <section className="editor-section">
        <div className="preset-grid">
          <button
            className={`chip ${layer.flipX ? 'is-active' : ''}`}
            onClick={() => updateLayer(layer.id, { flipX: !layer.flipX })}
          >
            Flip
          </button>
          <button className="chip" onClick={() => duplicateLayer(layer.id)}>
            Duplicate
          </button>
          <button className="chip" onClick={() => moveLayer(layer.id, 1)}>
            Bring forward
          </button>
          <button className="chip" onClick={() => moveLayer(layer.id, -1)}>
            Send back
          </button>
          <button
            className="chip danger"
            onClick={() => removeLayer(layer.id)}
          >
            Delete
          </button>
        </div>
      </section>
    </div>
  )
}
