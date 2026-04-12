import '@neondatabase/neon-js/ui/css'

import App from './App'
import { init } from 'ghostty-web'
import { Provider } from 'jotai'
import { StrictMode } from 'react'
import { store } from '@TTH/state/accessors'
import { createRoot } from 'react-dom/client'
import { Version } from '@TTH/components/Version'
import { overlayScrollBody } from '@tdsk/components'
import { AuthProvider } from '@TTH/contexts/AuthProvider'

overlayScrollBody()
init().catch(console.error)

createRoot(document.getElementById(`root`)!).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <App />
        <Version />
      </AuthProvider>
    </Provider>
  </StrictMode>
)
