import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { CURATED_COLORS, useStudio } from '../store'
import { productById } from '../products/catalog'
import { measureAspect } from '../utils/variants'
import { TEXT_FONTS } from '../utils/textRender'
import type { DesignVariable, PartState, DecalLayer, PartGroup } from '../types'

/** A compact color control: curated swatches + a native picker. */
function ColorControl({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (hex: string) => void
  label: string
}) {
  return (
    <div className="cc-color">
      <div className="cc-swatches">
        {CURATED_COLORS.map((c) => (
          <button
            key={c}
            className={`cc-swatch ${value.toUpperCase() === c.toUpperCase() ? 'is-active' : ''}`}
            style={{ background: c }}
            aria-label={`${label}: ${c}`}
            aria-pressed={value.toUpperCase() === c.toUpperCase()}
            onClick={() => onChange(c)}
          />
        ))}
        <label className="cc-swatch cc-well" title="Custom color">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
            aria-label={`${label} custom color`}
            onChange={(e) => onChange(e.target.value)}
          />
          <span aria-hidden>+</span>
        </label>
      </div>
    </div>
  )
}

/** Font picker used both by the font variable and consumer-added text. */
function FontControl({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (id: string) => void
  label: string
}) {
  return (
    <select
      className="search-input"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    >
      {TEXT_FONTS.map((f) => (
        <option key={f.id} value={f.id}>
          {f.label}
        </option>
      ))}
    </select>
  )
}

/** One editable variable rendered as a labelled consumer control. */
function VariableControl({
  variable,
  parts,
  layers,
  groups,
}: {
  variable: DesignVariable
  parts: PartState[]
  layers: DecalLayer[]
  groups: PartGroup[]
}) {
  const updatePart = useStudio((s) => s.updatePart)
  const setGroupColor = useStudio((s) => s.setGroupColor)
  const updateTextLayer = useStudio((s) => s.updateTextLayer)
  const updateLayer = useStudio((s) => s.updateLayer)
  const snapLayerToZone = useStudio((s) => s.snapLayerToZone)
  const productId = useStudio((s) => s.productId)
  const imgRef = useRef<HTMLInputElement>(null)

  const t = variable.target
  const product = productId ? productById(productId) : undefined

  const onImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || t.kind !== 'layerImage') return
    const reader = new FileReader()
    reader.onload = async () => {
      const src = String(reader.result)
      updateLayer(t.layerId, {
        image: src,
        aspect: await measureAspect(src),
        text: undefined,
        visible: true,
      })
    }
    reader.readAsDataURL(file)
  }

  const body = (() => {
    if (t.kind === 'partColor') {
      const part = parts.find((p) => p.id === t.partId)
      if (!part) return null
      return (
        <ColorControl
          label={variable.name}
          value={part.color}
          onChange={(hex) => updatePart(t.partId, { color: hex })}
        />
      )
    }
    if (t.kind === 'groupColor') {
      const group = groups.find((g) => g.id === t.groupId)
      const first = group && parts.find((p) => group.partIds.includes(p.id))
      if (!group) return null
      return (
        <ColorControl
          label={variable.name}
          value={first?.color ?? '#D4D4D8'}
          onChange={(hex) => setGroupColor(t.groupId, hex)}
        />
      )
    }
    if (t.kind === 'layerTextColor') {
      const layer = layers.find((l) => l.id === t.layerId)
      if (!layer?.text) return null
      return (
        <ColorControl
          label={variable.name}
          value={layer.text.color}
          onChange={(hex) => updateTextLayer(t.layerId, { ...layer.text!, color: hex })}
        />
      )
    }
    if (t.kind === 'layerTextFont') {
      const layer = layers.find((l) => l.id === t.layerId)
      if (!layer?.text) return null
      return (
        <FontControl
          label={variable.name}
          value={layer.text.font}
          onChange={(font) => updateTextLayer(t.layerId, { ...layer.text!, font })}
        />
      )
    }
    if (t.kind === 'layerText') {
      const layer = layers.find((l) => l.id === t.layerId)
      const spec = layer?.text
      return (
        <input
          className="search-input"
          value={spec?.content ?? ''}
          placeholder="Your text…"
          aria-label={variable.name}
          onChange={(e) =>
            spec &&
            updateTextLayer(t.layerId, { ...spec, content: e.target.value })
          }
        />
      )
    }
    if (t.kind === 'layerPlacement') {
      const layer = layers.find((l) => l.id === t.layerId)
      const zones = product?.zones ?? []
      if (zones.length === 0) return null
      return (
        <select
          className="search-input"
          value={layer?.zoneId ?? ''}
          aria-label={variable.name}
          onChange={(e) => e.target.value && snapLayerToZone(t.layerId, e.target.value)}
        >
          <option value="" disabled>
            Choose placement…
          </option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))}
        </select>
      )
    }
    if (t.kind === 'layerImage') {
      const layer = layers.find((l) => l.id === t.layerId)
      return (
        <div className="cc-image">
          {layer?.image && <img className="cc-image-thumb" src={layer.image} alt="" />}
          <button className="primary-btn outline" onClick={() => imgRef.current?.click()}>
            Upload artwork…
          </button>
          <input
            ref={imgRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={onImage}
          />
        </div>
      )
    }
    return null
  })()

  if (!body) return null
  return (
    <div className="cc-field">
      <span className="cc-label">{variable.name}</span>
      {body}
    </div>
  )
}

/** Full controls for a text/graphic layer the consumer added themselves. */
function ConsumerLayerCard({ layer }: { layer: DecalLayer }) {
  const updateTextLayer = useStudio((s) => s.updateTextLayer)
  const updateLayer = useStudio((s) => s.updateLayer)
  const removeLayer = useStudio((s) => s.removeLayer)
  const productId = useStudio((s) => s.productId)
  const snapLayerToZone = useStudio((s) => s.snapLayerToZone)
  const imgRef = useRef<HTMLInputElement>(null)
  const product = productId ? productById(productId) : undefined

  const onReplace = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const src = String(reader.result)
      updateLayer(layer.id, { image: src, aspect: await measureAspect(src), visible: true })
    }
    reader.readAsDataURL(file)
  }

  const zones = product?.zones ?? []

  return (
    <div className="cc-card">
      <div className="cc-card-head">
        <span className="cc-card-title">{layer.text ? 'Text' : 'Graphic'}</span>
        <button
          className="menu-text-btn inline"
          aria-label="Remove"
          onClick={() => removeLayer(layer.id)}
        >
          Remove
        </button>
      </div>

      {layer.text ? (
        <>
          <input
            className="search-input"
            value={layer.text.content}
            placeholder="Your text…"
            aria-label="Text content"
            onChange={(e) => updateTextLayer(layer.id, { ...layer.text!, content: e.target.value })}
          />
          <FontControl
            label="Font"
            value={layer.text.font}
            onChange={(font) => updateTextLayer(layer.id, { ...layer.text!, font })}
          />
          <ColorControl
            label="Text color"
            value={layer.text.color}
            onChange={(hex) => updateTextLayer(layer.id, { ...layer.text!, color: hex })}
          />
        </>
      ) : (
        <div className="cc-image">
          {layer.image && <img className="cc-image-thumb" src={layer.image} alt="" />}
          <button className="primary-btn outline" onClick={() => imgRef.current?.click()}>
            Replace artwork…
          </button>
          <input
            ref={imgRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={onReplace}
          />
        </div>
      )}

      {zones.length > 0 && (
        <select
          className="search-input"
          value={layer.zoneId ?? ''}
          aria-label="Placement"
          onChange={(e) => e.target.value && snapLayerToZone(layer.id, e.target.value)}
        >
          <option value="" disabled>
            Placement…
          </option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

/**
 * Parts outliner for the blanket "change colors" permission: a compact,
 * selectable list of every group (as one entry) and every ungrouped part,
 * with a single color picker for the current selection. Scales to models
 * with many parts far better than stacking a swatch grid per part.
 */
function ConsumerColorOutliner({
  parts,
  groups,
}: {
  parts: PartState[]
  groups: PartGroup[]
}) {
  const updatePart = useStudio((s) => s.updatePart)
  const setGroupColor = useStudio((s) => s.setGroupColor)
  const selectPart = useStudio((s) => s.selectPart)
  const selectedPartId = useStudio((s) => s.selectedPartId)

  const groupedIds = new Set(groups.flatMap((g) => g.partIds))
  const items = [
    ...groups.map((g) => {
      const first = parts.find((p) => g.partIds.includes(p.id))
      return {
        key: `g:${g.id}`,
        kind: 'group' as const,
        id: g.id,
        ids: g.partIds,
        name: g.name,
        color: first?.color ?? '#D4D4D8',
      }
    }),
    ...parts
      .filter((p) => !groupedIds.has(p.id))
      .map((p) => ({
        key: `p:${p.id}`,
        kind: 'part' as const,
        id: p.id,
        ids: [p.id],
        name: p.label,
        color: p.color,
      })),
  ]

  /* Selection is driven by the store so it stays in sync with viewport
     clicks (click a part in 3D → its row/color highlights, and vice versa).
     A grouped part maps to its group row. */
  const currentKey = (() => {
    const g = groups.find((gr) => selectedPartId && gr.partIds.includes(selectedPartId))
    if (g) return `g:${g.id}`
    if (selectedPartId && parts.some((p) => p.id === selectedPartId && !groupedIds.has(p.id)))
      return `p:${selectedPartId}`
    return items[0]?.key
  })()
  const current = items.find((i) => i.key === currentKey) ?? items[0]
  if (!current) return null

  /* selectPart resolves group-aware highlight in the store, so designer and
     consumer selection behave identically. */
  const choose = (item: (typeof items)[number]) => selectPart(item.ids[0])
  const apply = (hex: string) =>
    current.kind === 'group' ? setGroupColor(current.id, hex) : updatePart(current.id, { color: hex })

  return (
    <div className="cc-field">
      <span className="cc-label">Colors</span>
      <div className="cc-outliner" role="listbox" aria-label="Parts">
        {items.map((i) => (
          <button
            key={i.key}
            role="option"
            aria-selected={i.key === current.key}
            className={`cc-outline-row ${i.key === current.key ? 'is-selected' : ''}`}
            onClick={() => choose(i)}
          >
            <span className="cc-outline-dot" style={{ background: i.color }} />
            <span className="cc-outline-name">{i.name}</span>
            {i.kind === 'group' && <span className="cc-outline-tag">group</span>}
          </button>
        ))}
      </div>
      <ColorControl label={current.name} value={current.color} onChange={apply} />
    </div>
  )
}

/**
 * The consumer editing panel: the variables the designer marked editable,
 * plus — when the designer allowed it — a color outliner for every part and
 * the ability to add personal text and graphics. No materials, patterns, or
 * authoring chrome.
 */
export function ConsumerCustomizer() {
  const variables = useStudio((s) => s.variables)
  const parts = useStudio((s) => s.parts)
  const layers = useStudio((s) => s.layers)
  const groups = useStudio((s) => s.groups)
  const permissions = useStudio((s) => s.permissions)
  const resetParts = useStudio((s) => s.resetParts)
  const consumerAddText = useStudio((s) => s.consumerAddText)
  const consumerAddGraphic = useStudio((s) => s.consumerAddGraphic)
  const addRef = useRef<HTMLInputElement>(null)

  const editable = variables.filter((v) => v.editable)
  const mine = layers.filter((l) => l.source === 'consumer')
  const canAdd = permissions.addText || permissions.addGraphic
  const changeColors = !!permissions.changeColors

  /* Blanket color permission exposes an outliner of every part/group. When
     on, skip the individually-marked color variables so a part's color isn't
     offered twice. */
  const editableVars = changeColors
    ? editable.filter((v) => v.target.kind !== 'partColor' && v.target.kind !== 'groupColor')
    : editable

  const hasAnything = editable.length > 0 || canAdd || changeColors

  const onAddGraphic = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const src = String(reader.result)
      consumerAddGraphic(src, file.name.replace(/\.[^.]+$/, ''), await measureAspect(src))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="cc-panel">
      <div className="cc-head">
        <h3 className="cc-title">Customize</h3>
        {hasAnything && (
          <button className="menu-text-btn inline" onClick={resetParts} title="Reset to original">
            Reset
          </button>
        )}
      </div>

      {!hasAnything ? (
        <p className="editor-empty">
          This article isn't customizable — the designer didn't open up any
          options. You can still view it in 3D.
        </p>
      ) : (
        <div className="cc-fields">
          {changeColors && parts.length > 0 && (
            <ConsumerColorOutliner parts={parts} groups={groups} />
          )}

          {editableVars.map((v) => (
            <VariableControl
              key={v.id}
              variable={v}
              parts={parts}
              layers={layers}
              groups={groups}
            />
          ))}

          {mine.map((l) => (
            <ConsumerLayerCard key={l.id} layer={l} />
          ))}

          {canAdd && (
            <div className="cc-add">
              {permissions.addText && (
                <button className="primary-btn outline" onClick={consumerAddText}>
                  + Add text
                </button>
              )}
              {permissions.addGraphic && (
                <button className="primary-btn outline" onClick={() => addRef.current?.click()}>
                  + Add graphic
                </button>
              )}
              <input
                ref={addRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                onChange={onAddGraphic}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
