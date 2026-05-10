import App from './App'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
    <AnalyticsProvider>
      <App />
    </AnalyticsProvider>
  </StrictMode>
)
