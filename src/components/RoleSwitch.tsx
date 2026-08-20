import { useStudio } from '../store'
import type { Role } from '../types'

const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: 'designer', label: 'Designer', hint: 'Create & publish customizable articles' },
  { id: 'consumer', label: 'Consumer', hint: 'Browse the catalog & customize' },
]

/**
 * Segmented control that switches between the two experiences. Designers
 * author and publish; consumers browse the catalog and customize only the
 * variables a designer exposed.
 */
export function RoleSwitch({ compact = false }: { compact?: boolean }) {
  const role = useStudio((s) => s.role)
  const setRole = useStudio((s) => s.setRole)

  return (
    <div className={`role-switch ${compact ? 'compact' : ''}`} role="tablist" aria-label="Mode">
      {ROLES.map((r) => (
        <button
          key={r.id}
          role="tab"
          aria-selected={role === r.id}
          className={`role-switch-btn ${role === r.id ? 'is-active' : ''}`}
          title={r.hint}
          onClick={() => role !== r.id && setRole(r.id)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
