import '@neondatabase/neon-js/ui/css'
import App from './App'
import { StrictMode } from 'react'
import { Provider } from 'jotai'
import { store } from '@TAF/state/accessors'
import { createRoot } from 'react-dom/client'
import { authClient } from '@TAF/services/auth'
import { Version } from '@TAF/components/Version'
import { overlayScrollBody } from '@tdsk/components'
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react'

overlayScrollBody()

createRoot(document.getElementById(`root`)!).render(
  <StrictMode>
    <Provider store={store}>
      <NeonAuthUIProvider authClient={authClient}>
        <App />
      </NeonAuthUIProvider>
      <Version />
    </Provider>
  </StrictMode>,
)
