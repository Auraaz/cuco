import type { MouseEvent } from 'react'
import { useStudio } from '../store'
import { Eye, EyeOff, Close } from './Icons'

/**
 * Auto-generated list of editable parts. Designers can Ctrl/⌘-click (or use
 * the checkbox) to multi-select parts and bundle them into a group that
 * behaves as one control for consumers.
 */
export function PartsPanel() {
  const parts = useStudio((s) => s.parts)
  const groups = useStudio((s) => s.groups)
  const selectedPartId = useStudio((s) => s.selectedPartId)
  const selectedPartIds = useStudio((s) => s.selectedPartIds)
  const selectPart = useStudio((s) => s.selectPart)
  const togglePartInSelection = useStudio((s) => s.togglePartInSelection)
  const clearPartSelection = useStudio((s) => s.clearPartSelection)
  const createGroup = useStudio((s) => s.createGroupFromSelection)
  const removeGroup = useStudio((s) => s.removeGroup)
  const renameGroup = useStudio((s) => s.renameGroup)
  const updatePart = useStudio((s) => s.updatePart)

  /** Which group (if any) a part belongs to — shown as a tag. */
  const groupOf = (id: string) => groups.find((g) => g.partIds.includes(id))

  const onRowClick = (e: MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey) togglePartInSelection(id)
    else selectPart(id)
  }

  const multi = selectedPartIds.length

  return (
    <div className="parts-panel">
      <div className="parts-list" role="listbox" aria-label="Product parts">
        {parts.map((p) => {
          const inSelection = selectedPartIds.includes(p.id)
          const g = groupOf(p.id)
          return (
            <div
              key={p.id}
              role="option"
              aria-selected={p.id === selectedPartId}
              className={`part-row ${p.id === selectedPartId ? 'is-selected' : ''} ${
                inSelection ? 'is-checked' : ''
              } ${p.visible ? '' : 'is-hidden'}`}
              onClick={(e) => onRowClick(e, p.id)}
            >
              <button
                className={`part-check ${inSelection ? 'is-on' : ''}`}
                aria-label={inSelection ? `Deselect ${p.label}` : `Select ${p.label} for grouping`}
                aria-pressed={inSelection}
                onClick={(e) => {
                  e.stopPropagation()
                  togglePartInSelection(p.id)
                }}
              >
                <span className="part-check-box" aria-hidden />
              </button>
              <span className="part-dot" style={{ background: p.color }} />
              <span className="part-label">{p.label}</span>
              {g && (
                <span className="part-group-tag" title={`In ${g.name}`}>
                  {g.name}
                </span>
              )}
              <button
                className="icon-btn part-eye"
                aria-label={p.visible ? `Hide ${p.label}` : `Show ${p.label}`}
                onClick={(e) => {
                  e.stopPropagation()
                  updatePart(p.id, { visible: !p.visible })
                }}
              >
                {p.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          )
        })}
      </div>

      {/* Multi-select action bar */}
      {multi > 0 && (
        <div className="group-bar">
          <span className="group-bar-count">{multi} selected</span>
          <button className="primary-btn sm" disabled={multi < 2} onClick={createGroup}>
            Group as one
          </button>
          <button className="menu-text-btn inline" onClick={clearPartSelection}>
            Clear
          </button>
        </div>
      )}

      {/* Existing groups */}
      {groups.length > 0 && (
        <div className="group-list">
          <h4 className="section-label flush">Groups</h4>
          {groups.map((g) => (
            <div key={g.id} className="group-item">
              <input
                className="group-name-input"
                value={g.name}
                aria-label={`Group name`}
                spellCheck={false}
                onChange={(e) => renameGroup(g.id, e.target.value)}
              />
              <span className="group-count">{g.partIds.length} parts</span>
              <button
                className="icon-btn"
                aria-label={`Ungroup ${g.name}`}
                title="Ungroup"
                onClick={() => removeGroup(g.id)}
              >
                <Close size={14} />
              </button>
            </div>
          ))}
          <p className="editor-hint">
            A group's color is exposed to consumers as one control — changing it
            recolors every part in the group.
          </p>
        </div>
      )}

      <p className="editor-hint parts-hint">
        Tip: Ctrl/⌘-click parts (or their checkboxes) to select several, then
        <strong> Group as one</strong>.
      </p>
    </div>
  )
}
