import '@neondatabase/neon-js/ui/css'
import type { ReactNode } from 'react'

import App from '@TTH/App'
import { Provider } from 'jotai'
import { StrictMode } from 'react'
import { ERoleType, isValidRoleType } from '@tdsk/domain'
import { store } from '@TTH/state/accessors'
import { createRoot } from 'react-dom/client'
import { Version } from '@TTH/components/Version'
import { AuthProvider } from '@TTH/contexts/AuthProvider'
import { useUser, useActiveOrgRole } from '@TTH/state/selectors'
import {
  TDSK_POSTHOG_KEY,
  TDSK_POSTHOG_HOST,
  VITEST,
  Environment,
} from '@TTH/constants/envs'
import {
  initAnalytics,
  AnalyticsProvider,
  overlayScrollBody,
  PermissionsProvider,
} from '@tdsk/components'

const ThreadsPermissionsProvider = ({ children }: { children: ReactNode }) => {
  const [user] = useUser()
  const [activeOrgRole] = useActiveOrgRole()
  const role: ERoleType | null =
    user?.role === `super`
      ? ERoleType.super
      : activeOrgRole && isValidRoleType(activeOrgRole)
        ? activeOrgRole
        : null

  return <PermissionsProvider role={role}>{children}</PermissionsProvider>
}

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
        <ThreadsPermissionsProvider>
          <AnalyticsProvider>
            <App />
            <Version />
          </AnalyticsProvider>
        </ThreadsPermissionsProvider>
      </AuthProvider>
    </Provider>
  </StrictMode>
)
