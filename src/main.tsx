import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initPersistence } from './persistence'
import { initRouting } from './routing'
import { warmFabricCache } from './materials/fabricTextures'
import { openRemoteModel } from './utils/remoteModel'

initPersistence()
initRouting()
/* Pre-bake fabric normal maps during idle time so switching materials is
   an instant cache hit instead of a synchronous main-thread bake. */
warmFabricCache()

/* Shareable deep link: ?model=<https .glb> loads a remote model on open. */
const modelParam = new URLSearchParams(location.search).get('model')
if (modelParam) {
  void openRemoteModel(modelParam)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
