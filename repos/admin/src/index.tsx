import '@neondatabase/neon-js/ui/css'

import App from './App'
import { Provider } from 'jotai'
import { StrictMode } from 'react'
import { store } from '@TAF/state/accessors'
import { createRoot } from 'react-dom/client'
import { Version } from '@TAF/components/Version'
import { overlayScrollBody } from '@tdsk/components'
import { AuthProvider } from '@TAF/contexts/AuthProvider'

overlayScrollBody()

createRoot(document.getElementById(`root`)!).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <App />
      </AuthProvider>
      <Version />
    </Provider>
  </StrictMode>,
)
