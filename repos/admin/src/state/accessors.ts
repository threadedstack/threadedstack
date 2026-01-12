import type { EThemeType } from '@TAF/types'
import type {
  User,
  Project,
  Config,
  Secret,
  ApiKey,
  Provider,
  Endpoint,
  Organization,
  Function as TDFunction,
} from '@tdsk/domain'

import { createStore } from 'jotai'
import { userState } from '@TAF/state/user'
import { providersState } from '@TAF/state/providers'
import { themeTypeState, defThemeType } from '@TAF/state/theme'
import { sidebarOpenState, defSidebarOpen } from '@TAF/state/app'
import { orgsState, activeOrgIdState } from '@TAF/state/orgs'
import { projectsState, activeProjectIdState } from '@TAF/state/projects'
import { secretsState, activeSecretIdState } from '@TAF/state/secrets'
import { apiKeysState, activeApiKeyIdState } from '@TAF/state/apiKeys'
import { endpointsState, activeEndpointIdState } from '@TAF/state/endpoints'
import { functionsState, activeFunctionIdState } from '@TAF/state/functions'
import { configsState, activeConfigIdState } from '@TAF/state/configs'

export const store = createStore()

export const getThemeType = () => store.get(themeTypeState)
export const resetThemeType = () => store.set(themeTypeState, defThemeType)
export const setThemeType = (type: EThemeType) => store.set(themeTypeState, type)

export const getSidebarOpen = () => store.get(sidebarOpenState)
export const resetSidebarOpen = () => store.set(sidebarOpenState, defSidebarOpen)
export const setSidebarOpen = (status: boolean) => store.set(sidebarOpenState, status)

export const getUser = () => store.get(userState)
export const resetUser = () => store.set(userState, undefined)
export const setUser = (user: User) => store.set(userState, user)

export const getOrgs = () => store.get(orgsState)
export const resetOrgs = () => store.set(orgsState, undefined)
export const setOrgs = (orgs: Record<string, Organization>) => store.set(orgsState, orgs)

export const getActiveOrgId = () => store.get(activeOrgIdState)
export const resetActiveOrgId = () => store.set(activeOrgIdState, undefined)
export const setActiveOrgId = (id: string) => store.set(activeOrgIdState, id)

export const getProjects = () => store.get(projectsState)
export const resetProjects = () => store.set(projectsState, undefined)
export const setProjects = (projects: Record<string, Project>) =>
  store.set(projectsState, projects)

export const getActiveprojectId = () => store.get(activeProjectIdState)
export const resetActiveprojectId = () => store.set(activeProjectIdState, undefined)
export const setActiveprojectId = (id: string) => store.set(activeProjectIdState, id)

export const getProviders = () => store.get(providersState)
export const resetProviders = () => store.set(providersState, undefined)
export const setProviders = (providers: Record<string, Provider>) =>
  store.set(providersState, providers)

export const getSecrets = () => store.get(secretsState)
export const resetSecrets = () => store.set(secretsState, undefined)
export const setSecrets = (secrets: Record<string, Secret>) =>
  store.set(secretsState, secrets)

export const getActiveSecretId = () => store.get(activeSecretIdState)
export const resetActiveSecretId = () => store.set(activeSecretIdState, undefined)
export const setActiveSecretId = (id: string) => store.set(activeSecretIdState, id)

export const getEndpoints = () => store.get(endpointsState)
export const resetEndpoints = () => store.set(endpointsState, undefined)
export const setEndpoints = (endpoints: Record<string, Endpoint>) =>
  store.set(endpointsState, endpoints)

export const getActiveEndpointId = () => store.get(activeEndpointIdState)
export const resetActiveEndpointId = () => store.set(activeEndpointIdState, undefined)
export const setActiveEndpointId = (id: string) => store.set(activeEndpointIdState, id)

export const getFunctions = () => store.get(functionsState)
export const resetFunctions = () => store.set(functionsState, undefined)
export const setFunctions = (functions: Record<string, TDFunction>) =>
  store.set(functionsState, functions)

export const getActiveFunctionId = () => store.get(activeFunctionIdState)
export const resetActiveFunctionId = () => store.set(activeFunctionIdState, undefined)
export const setActiveFunctionId = (id: string) => store.set(activeFunctionIdState, id)

export const getConfigs = () => store.get(configsState)
export const resetConfigs = () => store.set(configsState, undefined)
export const setConfigs = (configs: Record<string, Config>) =>
  store.set(configsState, configs)

export const getActiveConfigId = () => store.get(activeConfigIdState)
export const resetActiveConfigId = () => store.set(activeConfigIdState, undefined)
export const setActiveConfigId = (id: string) => store.set(activeConfigIdState, id)

export const getApiKeys = () => store.get(apiKeysState)
export const resetApiKeys = () => store.set(apiKeysState, undefined)
export const setApiKeys = (apiKeys: Record<string, ApiKey>) =>
  store.set(apiKeysState, apiKeys)
export const setApiKey = (apiKey: ApiKey) => {
  const current = store.get(apiKeysState) || {}
  store.set(apiKeysState, { ...current, [apiKey.id]: apiKey })
}
export const removeApiKey = (id: string) => {
  const current = store.get(apiKeysState) || {}
  const { [id]: _, ...rest } = current
  store.set(apiKeysState, rest)
}

export const getActiveApiKeyId = () => store.get(activeApiKeyIdState)
export const resetActiveApiKeyId = () => store.set(activeApiKeyIdState, undefined)
export const setActiveApiKeyId = (id: string) => store.set(activeApiKeyIdState, id)
