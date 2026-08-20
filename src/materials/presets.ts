import type { MaterialPreset, MaterialPresetId } from '../types'

export const MATERIAL_PRESETS: MaterialPreset[] = [
  { id: 'cotton', label: 'Cotton', roughness: 0.92, metalness: 0.0 },
  { id: 'denim', label: 'Denim', roughness: 0.85, metalness: 0.02 },
  { id: 'fleece', label: 'Fleece', roughness: 1.0, metalness: 0.0 },
  { id: 'leather', label: 'Leather', roughness: 0.55, metalness: 0.05 },
  { id: 'plastic', label: 'Plastic', roughness: 0.25, metalness: 0.08 },
  { id: 'mesh', label: 'Mesh', roughness: 0.75, metalness: 0.0 },
]

export const presetById = (id: MaterialPresetId): MaterialPreset =>
  MATERIAL_PRESETS.find((p) => p.id === id) ?? MATERIAL_PRESETS[0]
