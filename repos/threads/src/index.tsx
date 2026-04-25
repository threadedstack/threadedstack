import '@neondatabase/neon-js/ui/css'
import type { ReactNode } from 'react'

import App from '@TTH/App'
import { Provider } from 'jotai'
import { StrictMode } from 'react'
import { init } from 'ghostty-web'
import { ERoleType, isValidRoleType } from '@tdsk/domain'
import { store } from '@TTH/state/accessors'
import { createRoot } from 'react-dom/client'
import { Version } from '@TTH/components/Version'
import { overlayScrollBody } from '@tdsk/components'
import { PermissionsProvider } from '@tdsk/components'
import { AuthProvider } from '@TTH/contexts/AuthProvider'
import { useUser, useActiveOrgRole } from '@TTH/state/selectors'

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
init().catch(console.error)

createRoot(document.getElementById(`root`)!).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <ThreadsPermissionsProvider>
          <App />
          <Version />
        </ThreadsPermissionsProvider>
      </AuthProvider>
    </Provider>
  </StrictMode>
)
