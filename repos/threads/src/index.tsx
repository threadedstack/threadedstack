import '@neondatabase/neon-js/ui/css'
import type { ReactNode } from 'react'

import App from '@TTH/App'
import { Provider } from 'jotai'
import { StrictMode } from 'react'
import { store } from '@TTH/state/accessors'
import { createRoot } from 'react-dom/client'
import { Version } from '@TTH/components/Version'
import { AuthProvider } from '@TTH/contexts/AuthProvider'
import { ERoleType, isValidRoleType } from '@tdsk/domain'
import { useUser, useActiveOrgRole } from '@TTH/state/selectors'
import {
  VITEST,
  Environment,
  TDSK_POSTHOG_KEY,
  TDSK_POSTHOG_HOST,
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

/**
 * TODO: figure out why this is even needed
 * The threads app is crashing without it when developing locally, but it should not be needed
 */
const container = document.getElementById(`root`)!
const root = (container as any).__reactRoot ?? createRoot(container)
;(container as any).__reactRoot = root
root.render(
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
