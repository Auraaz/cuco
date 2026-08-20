import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { CURATED_COLORS, useStudio } from '../store'
import { MATERIAL_PRESETS } from '../materials/presets'
import { PATTERNS, renderPattern } from '../materials/patterns'
import { VariableToggle } from './VariableToggle'

const HEX_RE = /^#?([0-9a-f]{6})$/i

/** Small check glyph shown on the active swatch — a non-color cue so the
 *  selection is legible to color-blind users, not just via the ring. */
function Check() {
  return (
    <svg
      className="swatch-check"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

/** Readable check color for a given swatch background. */
function checkColor(hex: string): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#18181B' : '#FFFFFF'
}

/** Full editing controls for the currently selected part. */
export function PartEditor() {
  const part = useStudio((s) =>
    s.parts.find((p) => p.id === s.selectedPartId),
  )
  const updatePart = useStudio((s) => s.updatePart)
  const applyPreset = useStudio((s) => s.applyPreset)
  const applyPattern = useStudio((s) => s.applyPattern)
  const setPartTexture = useStudio((s) => s.setPartTexture)
  const updatePartTexture = useStudio((s) => s.updatePartTexture)
  const recentColors = useStudio((s) => s.recentColors)
  const pushRecentColor = useStudio((s) => s.pushRecentColor)

  const [hexDraft, setHexDraft] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const texRef = useRef<HTMLInputElement>(null)
  useEffect(() => setHexDraft(part?.color.toUpperCase() ?? ''), [part?.color, part?.id])

  /* Pattern thumbnails rendered in the current base color. */
  const patternPreviews = useMemo(
    () => PATTERNS.map((p) => ({ ...p, src: renderPattern(p.id, part?.color ?? '#D4D4D8') })),
    [part?.color],
  )

  if (!part) return <p className="editor-empty">Select a part to edit it.</p>

  const onTextureFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () =>
      setPartTexture(part.id, { src: String(reader.result), scale: 3, rotation: 0 })
    reader.readAsDataURL(file)
  }

  const setColor = (c: string, commit = true) => {
    updatePart(part.id, { color: c })
    if (commit) pushRecentColor(c.toUpperCase())
  }

  const commitHex = () => {
    const m = hexDraft.match(HEX_RE)
    if (m) setColor(`#${m[1].toUpperCase()}`)
    else setHexDraft(part.color.toUpperCase())
  }

  return (
    <div className="editor">
      <h3 className="editor-title">{part.label}</h3>

      <section className="editor-section">
        <div className="section-head">
          <h4 className="section-label">Color</h4>
          <VariableToggle
            type="color"
            target={{ kind: 'partColor', partId: part.id }}
            label={`${part.label} color`}
            defaultName={`${part.label} Color`}
          />
        </div>
        <div className="swatch-grid">
          {CURATED_COLORS.map((c) => {
            const active = part.color.toUpperCase() === c.toUpperCase()
            return (
              <button
                key={c}
                className={`swatch ${active ? 'is-active' : ''}`}
                style={{ background: c, color: checkColor(c) }}
                aria-label={`Set color ${c}`}
                aria-pressed={active}
                onClick={() => setColor(c)}
              >
                {active && <Check />}
              </button>
            )
          })}
        </div>

        <div className="hex-row">
          <label className="color-well" aria-label="Custom color">
            <input
              type="color"
              value={part.color}
              onChange={(e) => setColor(e.target.value, false)}
              onBlur={(e) => pushRecentColor(e.target.value.toUpperCase())}
            />
            <span style={{ background: part.color }} />
          </label>
          <input
            className="hex-input"
            value={hexDraft}
            spellCheck={false}
            aria-label="Hex color"
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => e.key === 'Enter' && commitHex()}
          />
        </div>

        {/* Reserved row — always present so controls never jump when the
            first color is picked. */}
        <h4 className="section-label">Recent</h4>
        <div className="swatch-grid recent-grid">
          {recentColors.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="swatch swatch-empty" aria-hidden />
              ))
            : recentColors.map((c) => {
                const active = part.color.toUpperCase() === c.toUpperCase()
                return (
                  <button
                    key={c}
                    className={`swatch ${active ? 'is-active' : ''}`}
                    style={{ background: c, color: checkColor(c) }}
                    aria-label={`Set color ${c}`}
                    aria-pressed={active}
                    onClick={() => setColor(c, false)}
                  >
                    {active && <Check />}
                  </button>
                )
              })}
        </div>
      </section>

      <section className="editor-section">
        <h4 className="section-label">Material</h4>
        <div className="preset-grid">
          {MATERIAL_PRESETS.map((m) => (
            <button
              key={m.id}
              className={`chip ${part.preset === m.id ? 'is-active' : ''}`}
              onClick={() => applyPreset(part.id, m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <section className="editor-section">
        <div className="section-head">
          <h4 className="section-label">Pattern &amp; texture</h4>
          {part.texture && (
            <button className="menu-text-btn inline" onClick={() => setPartTexture(part.id, null)}>
              Remove
            </button>
          )}
        </div>
        <div className="pattern-grid">
          <button
            className={`pattern-swatch ${!part.texture ? 'is-active' : ''}`}
            style={{ background: part.color }}
            aria-label="No pattern"
            title="None"
            onClick={() => setPartTexture(part.id, null)}
          >
            {!part.texture && <Check />}
          </button>
          {patternPreviews.map((p) => (
            <button
              key={p.id}
              className={`pattern-swatch ${part.texture?.patternId === p.id ? 'is-active' : ''}`}
              style={{ backgroundImage: `url(${p.src})` }}
              aria-label={`Pattern ${p.label}`}
              aria-pressed={part.texture?.patternId === p.id}
              title={p.label}
              onClick={() => applyPattern(part.id, p.id)}
            />
          ))}
          <button
            className={`pattern-swatch upload ${part.texture && !part.texture.patternId ? 'is-active' : ''}`}
            aria-label="Upload texture image"
            title="Upload image"
            onClick={() => texRef.current?.click()}
          >
            {part.texture && !part.texture.patternId ? (
              <img src={part.texture.src} alt="" />
            ) : (
              '+'
            )}
          </button>
        </div>
        <input
          ref={texRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          hidden
          onChange={onTextureFile}
        />

        {part.texture && (
          <div className="advanced-body" style={{ marginTop: 10 }}>
            <label className="slider-row">
              <span>Scale</span>
              <input
                type="range"
                aria-label="Pattern scale"
                min={1}
                max={16}
                step={0.5}
                value={part.texture.scale}
                onChange={(e) => updatePartTexture(part.id, { scale: Number(e.target.value) })}
              />
              <output>{part.texture.scale.toFixed(1)}×</output>
            </label>
            <label className="slider-row">
              <span>Rotation</span>
              <input
                type="range"
                aria-label="Pattern rotation"
                min={0}
                max={360}
                step={1}
                value={part.texture.rotation}
                onChange={(e) => updatePartTexture(part.id, { rotation: Number(e.target.value) })}
              />
              <output>{Math.round(part.texture.rotation)}°</output>
            </label>
          </div>
        )}
      </section>

      <section className="editor-section">
        <button
          className="advanced-toggle"
          aria-expanded={advanced}
          onClick={() => setAdvanced((v) => !v)}
        >
          Advanced
          <span className={`chevron ${advanced ? 'open' : ''}`} aria-hidden>
            ›
          </span>
        </button>
        {advanced && (
          <div className="advanced-body">
            <label className="slider-row">
              <span>Roughness</span>
              <input
                type="range"
                aria-label="Roughness"
                min={0}
                max={1}
                step={0.01}
                value={part.roughness}
                onChange={(e) =>
                  updatePart(part.id, { roughness: Number(e.target.value) })
                }
              />
              <output>{part.roughness.toFixed(2)}</output>
            </label>
            <label className="slider-row">
              <span>Metalness</span>
              <input
                type="range"
                aria-label="Metalness"
                min={0}
                max={1}
                step={0.01}
                value={part.metalness}
                onChange={(e) =>
                  updatePart(part.id, { metalness: Number(e.target.value) })
                }
              />
              <output>{part.metalness.toFixed(2)}</output>
            </label>
          </div>
        )}
      </section>
    </div>
  )
}
