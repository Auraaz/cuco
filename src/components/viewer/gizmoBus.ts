/**
 * Lightweight bridge between the in-canvas projector (which knows the
 * camera + mesh matrices) and the DOM transform-gizmo overlay (which
 * draws handles and reads pointer input). Written every frame by the
 * projector, read every frame by the overlay's rAF loop — deliberately
 * outside React so neither side re-renders at 60fps.
 */

export interface GizmoScreen {
  /** Screen-space center of the decal, in CSS px relative to the canvas. */
  cx: number
  cy: number
  /** Center → right-edge vector (px). Length = half the box width. */
  rx: number
  ry: number
  /** Center → top-edge vector (px). Length = half the box height. */
  ux: number
  uy: number
}

interface GizmoBus {
  screen: GizmoScreen | null
}

export const gizmoBus: GizmoBus = { screen: null }
