import type { Atom } from 'jotai'
import type { atomWithReset } from 'jotai/utils'
import type { Organization, Project } from '@tdsk/domain'

import { useResetAtom } from 'jotai/utils'

import { useAtom } from 'jotai'
import { userState } from '@TAF/state/user'
import { noOp } from '@keg-hub/jsutils/noOp'
import { sidebarOpenState } from '@TAF/state/app'
import { themeTypeState } from '@TAF/state/theme'
import { providersState } from '@TAF/state/providers'
import { secretsState, activeSecretIdState } from '@TAF/state/secrets'
import { apiKeysState, activeApiKeyIdState } from '@TAF/state/apiKeys'
import { configsState, activeConfigIdState } from '@TAF/state/configs'
import { endpointsState, activeEndpointIdState } from '@TAF/state/endpoints'
import { functionsState, activeFunctionIdState } from '@TAF/state/functions'
import {
  projectsState,
  activeProjectState,
  activeProjectIdState,
} from '@TAF/state/projects'
import {
  orgsState,
  orgUsersState,
  activeOrgState,
  activeOrgIdState,
  activeOrgRoleState,
} from '@TAF/state/orgs'

const useRecState = <T = any>(state: ReturnType<typeof atomWithReset<T>>) => {
  const [current, setCurrent] = useAtom(state)
  const resetCurrent = useResetAtom(state)

  return [current, setCurrent, resetCurrent] as [
    T,
    typeof setCurrent,
    typeof resetCurrent,
  ]
}

const useDerivedState = <T = any>(state: Atom<T>) => {
  const [current, setCurrent] = useAtom(state)
  return [current, setCurrent, noOp] as [T, typeof setCurrent, typeof noOp]
}

export const useUser = () => useRecState(userState)
export const useProviders = () => useRecState(providersState)
export const useThemeType = () => useRecState(themeTypeState)
export const useSidebarOpen = () => useRecState(sidebarOpenState)
export const useOrgs = () => useRecState(orgsState)
export const useActiveOrgId = () => useRecState(activeOrgIdState)
export const useOrgUsers = () => useRecState(orgUsersState)
export const useProjects = () => useRecState(projectsState)
export const useActiveprojectId = () => useRecState(activeProjectIdState)
export const useSecrets = () => useRecState(secretsState)
export const useActiveSecretId = () => useRecState(activeSecretIdState)
export const useEndpoints = () => useRecState(endpointsState)
export const useActiveEndpointId = () => useRecState(activeEndpointIdState)
export const useFunctions = () => useRecState(functionsState)
export const useActiveFunctionId = () => useRecState(activeFunctionIdState)
export const useConfigs = () => useRecState(configsState)
export const useActiveConfigId = () => useRecState(activeConfigIdState)
export const useApiKeys = () => useRecState(apiKeysState)
export const useActiveApiKeyId = () => useRecState(activeApiKeyIdState)
export const useActiveOrgRole = () => useRecState(activeOrgRoleState)
export const useActiveOrg = () => useDerivedState<Organization>(activeOrgState)
export const useActiveProject = () => useDerivedState<Project>(activeProjectState)
