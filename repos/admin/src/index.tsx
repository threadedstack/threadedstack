import '@neondatabase/neon-js/ui/css'

import App from './App'
import { Provider } from 'jotai'
import { StrictMode } from 'react'
import { store } from '@TAF/state/accessors'
import { createRoot } from 'react-dom/client'
import { Version } from '@TAF/components/Version'
import { AuthProvider } from '@TAF/contexts/AuthProvider'
import { overlayScrollBody, initAnalytics, AnalyticsProvider } from '@tdsk/components'
import {
  TDSK_POSTHOG_KEY,
  TDSK_POSTHOG_HOST,
  VITEST,
  Environment,
} from '@TAF/constants/envs'

overlayScrollBody()
initAnalytics({
  key: TDSK_POSTHOG_KEY,
  host: TDSK_POSTHOG_HOST,
  disabled: VITEST || Environment === `local`,
})

createRoot(document.getElementById(`root`)!).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <AnalyticsProvider>
          <App />
          <Version />
        </AnalyticsProvider>
      </AuthProvider>
    </Provider>
  </StrictMode>
)
