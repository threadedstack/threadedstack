import App from './App'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { overlayScrollBody } from '@tdsk/components'

overlayScrollBody()

createRoot(document.getElementById(`root`)!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
