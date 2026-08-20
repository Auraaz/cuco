import { Component, type ReactNode } from 'react'
import { useStudio } from '../../store'

/**
 * Catches errors thrown while loading/rendering the model (e.g. a dropped
 * file that isn't a valid GLB). Instead of white-screening the canvas it
 * bails back to the picker with a toast.
 */
export class ModelBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    useStudio.getState().toast("Couldn't load that model — use a valid .glb or .gltf file.")
    useStudio.getState().closeProduct()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
