import { useState } from 'react'
import { TEXT_FONTS } from '../utils/textRender'
import type { DesignVariable, VariableType, Zone } from '../types'
import type { VariantRow } from '../utils/variants'
import { Close } from './Icons'

let vbSeq = 1

interface BuilderRow {
  id: number
  name: string
  values: Record<string, string>
}

const TYPE_LABEL: Record<VariableType, string> = {
  color: 'Color',
  text: 'Text',
  graphic: 'Artwork',
  placement: 'Placement',
  font: 'Font',
}

/** One editable cell, typed to its variable. */
function Cell({
  variable,
  value,
  zones,
  onChange,
}: {
  variable: DesignVariable
  value: string
  zones: Zone[]
  onChange: (v: string) => void
}) {
  if (variable.type === 'color') {
    const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
    return (
      <label className="vb-color" title={hex.toUpperCase()}>
        <input
          type="color"
          value={hex}
          aria-label={`${variable.name} color`}
          onChange={(e) => onChange(e.target.value)}
        />
        <span style={{ background: hex }} />
      </label>
    )
  }
  if (variable.type === 'font') {
    return (
      <select
        className="vb-input"
        value={value || 'sans'}
        aria-label={`${variable.name} font`}
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
  if (variable.type === 'placement') {
    return (
      <select
        className="vb-input"
        value={value}
        aria-label={`${variable.name} placement`}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.label}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      className="vb-input"
      value={value}
      placeholder={variable.type === 'graphic' ? 'file / URL' : 'value'}
      aria-label={variable.name}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * In-app variant grid: add rows and set a value per variable column (pick
 * colors, choose fonts/placements, type text), then generate colorways in
 * bulk — no spreadsheet round-trip. New rows are seeded from the current
 * design so you only change what varies.
 */
export function VariantBuilder({
  variables,
  zones,
  seedValue,
  busy,
  onGenerate,
}: {
  variables: DesignVariable[]
  zones: Zone[]
  seedValue: (v: DesignVariable) => string
  busy: boolean
  onGenerate: (rows: VariantRow[]) => void
}) {
  const [rows, setRows] = useState<BuilderRow[]>([])

  const makeRow = (index: number): BuilderRow => {
    const values: Record<string, string> = {}
    for (const v of variables) values[v.name] = seedValue(v)
    return { id: vbSeq++, name: `Variant ${index + 1}`, values }
  }

  const addRow = () => setRows((prev) => [...prev, makeRow(prev.length)])
  const removeRow = (id: number) => setRows((prev) => prev.filter((r) => r.id !== id))
  const duplicateRow = (id: number) =>
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === id)
      if (i < 0) return prev
      const copy: BuilderRow = {
        ...prev[i],
        id: vbSeq++,
        name: `${prev[i].name} copy`,
        values: { ...prev[i].values },
      }
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)]
    })
  const setName = (id: number, name: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)))
  const setCell = (id: number, col: string, val: string) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, values: { ...r.values, [col]: val } } : r)),
    )

  const generate = () => {
    if (busy || rows.length === 0) return
    const built: VariantRow[] = rows.map((r, i) => ({
      name: r.name.trim() || `Variant ${i + 1}`,
      values: { ...r.values },
    }))
    onGenerate(built)
  }

  if (variables.length === 0) {
    return (
      <p className="editor-hint">
        Make a color, text, font, artwork or placement a <strong>variable</strong> first —
        each becomes a column you can fill in here.
      </p>
    )
  }

  return (
    <div className="vb">
      <div className="vb-scroll">
        <table className="vb-table">
          <thead>
            <tr>
              <th className="vb-th-name">Name</th>
              {variables.map((v) => (
                <th key={v.id}>
                  <span className={`var-type-chip ${v.type}`}>{TYPE_LABEL[v.type]}</span>
                  <span className="vb-th-name-txt">{v.name}</span>
                </th>
              ))}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="vb-empty" colSpan={variables.length + 2}>
                  No rows yet — add one to start building variants.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      className="vb-input vb-name"
                      value={r.name}
                      aria-label="Variant name"
                      onChange={(e) => setName(r.id, e.target.value)}
                    />
                  </td>
                  {variables.map((v) => (
                    <td key={v.id}>
                      <Cell
                        variable={v}
                        value={r.values[v.name] ?? ''}
                        zones={zones}
                        onChange={(val) => setCell(r.id, v.name, val)}
                      />
                    </td>
                  ))}
                  <td className="vb-actions">
                    <button
                      className="icon-btn"
                      title="Duplicate row"
                      aria-label="Duplicate row"
                      onClick={() => duplicateRow(r.id)}
                    >
                      ⧉
                    </button>
                    <button
                      className="icon-btn"
                      title="Remove row"
                      aria-label="Remove row"
                      onClick={() => removeRow(r.id)}
                    >
                      <Close size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="vb-foot">
        <button className="primary-btn outline" onClick={addRow}>
          + Add row
        </button>
        <button className="primary-btn" disabled={busy || rows.length === 0} onClick={generate}>
          {busy
            ? 'Generating…'
            : `Generate ${rows.length} variant${rows.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}
