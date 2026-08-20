import { useStudio } from '../store'
import { sameTarget } from '../utils/variants'
import type { VariableTarget, VariableType } from '../types'

/**
 * Inline control that promotes one design element (a part color, a text,
 * font, artwork layer, or placement) to a spreadsheet-driven variable —
 * and, in one click, marks it editable by consumers of the published
 * article. When on, it exposes the column name the importer reads and a
 * "Consumer editable" switch.
 */
export function VariableToggle({
  type,
  target,
  label,
  defaultName,
}: {
  type: VariableType
  target: VariableTarget
  label: string
  defaultName: string
}) {
  const existing = useStudio((s) =>
    s.variables.find((v) => sameTarget(v.target, target)),
  )
  const addVariable = useStudio((s) => s.addVariable)
  const removeVariableForTarget = useStudio((s) => s.removeVariableForTarget)
  const renameVariable = useStudio((s) => s.renameVariable)
  const setVariableEditable = useStudio((s) => s.setVariableEditable)
  const on = !!existing

  return (
    <div className={`var-toggle ${on ? 'is-on' : ''}`}>
      <button
        type="button"
        className="var-toggle-btn"
        aria-pressed={on}
        title={
          on
            ? 'This element is a variable — click to unbind'
            : 'Make this a variable (for auto-variants and consumer editing)'
        }
        onClick={() =>
          on
            ? removeVariableForTarget(target)
            : addVariable(type, target, label, defaultName)
        }
      >
        <span className="var-dot" aria-hidden />
        {on ? 'Variable' : 'Make variable'}
      </button>
      {existing && (
        <>
          <label className="var-col">
            <span className="var-col-label">column</span>
            <input
              className="var-col-input"
              value={existing.name}
              aria-label={`Spreadsheet column for ${label}`}
              spellCheck={false}
              onChange={(e) => renameVariable(existing.id, e.target.value)}
            />
          </label>
          <button
            type="button"
            className={`var-editable sm ${existing.editable ? 'is-on' : ''}`}
            role="switch"
            aria-checked={!!existing.editable}
            title={
              existing.editable
                ? 'Consumers can edit this — click to keep it designer-only'
                : 'Let consumers edit this in the published article'
            }
            onClick={() => setVariableEditable(existing.id, !existing.editable)}
          >
            <span className="var-editable-dot" aria-hidden />
            {existing.editable ? 'Consumer editable' : 'Designer only'}
          </button>
        </>
      )}
    </div>
  )
}
