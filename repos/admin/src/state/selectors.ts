import type { WritableAtom } from 'jotai'
import type { atomWithReset } from 'jotai/utils'

import { useResetAtom } from 'jotai/utils'

import { useAtom } from 'jotai'
import { userState } from '@TAF/state/user'
import { sidebarOpenState } from '@TAF/state/app'
import { themeTypeState } from '@TAF/state/theme'
import { providersState } from '@TAF/state/providers'
import { orgsState, activeOrgIdState } from '@TAF/state/orgs'
import { projectsState, activeProjectIdState } from '@TAF/state/projects'
import { secretsState, activeSecretIdState } from '@TAF/state/secrets'
import { apiKeysState, activeApiKeyIdState } from '@TAF/state/apiKeys'
import { endpointsState, activeEndpointIdState } from '@TAF/state/endpoints'
import { functionsState, activeFunctionIdState } from '@TAF/state/functions'
import { configsState, activeConfigIdState } from '@TAF/state/configs'

const useRecState = <T = any>(state: ReturnType<typeof atomWithReset<T>>) => {
  const [current, setCurrent] = useAtom(state)
  const resetCurrent = useResetAtom(state)

  return [current, setCurrent, resetCurrent] as [
    T,
    typeof setCurrent,
    typeof resetCurrent,
  ]
}

export const useUser = () => useRecState(userState)
export const useProviders = () => useRecState(providersState)
export const useThemeType = () => useRecState(themeTypeState)
export const useSidebarOpen = () => useRecState(sidebarOpenState)
export const useOrgs = () => useRecState(orgsState)
export const useActiveOrgId = () => useRecState(activeOrgIdState)
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
