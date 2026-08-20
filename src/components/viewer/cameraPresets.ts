import type { CameraPresetDef } from '../../types'

const TARGET: [number, number, number] = [0, 0.1, 0]
const R = 7.6

export const CAMERA_PRESETS: CameraPresetDef[] = [
  { id: 'front', label: 'Front', position: [0, 0.5, R], target: TARGET },
  { id: 'back', label: 'Back', position: [0, 0.5, -R], target: TARGET },
  { id: 'left', label: 'Left', position: [-R, 0.5, 0], target: TARGET },
  { id: 'right', label: 'Right', position: [R, 0.5, 0], target: TARGET },
  { id: 'top', label: 'Top', position: [0, R + 0.6, 0.02], target: TARGET },
  { id: 'perspective', label: 'Hero', position: [4.6, 2.5, 5.6], target: TARGET },
]

export const cameraPresetById = (id: string) =>
  CAMERA_PRESETS.find((p) => p.id === id)
