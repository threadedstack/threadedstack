import type {
  EThemeType,
  TQuotaData,
  TLimitsData,
  TProxyFormState,
  TFaasFormState,
  TAgentFormState,
  TRailSectionId,
} from '@TAF/types'
import type {
  User,
  Plan,
  Asset,
  Agent,
  Secret,
  ApiKey,
  Domain,
  Thread,
  Message,
  Project,
  Provider,
  Endpoint,
  Subscription,
  Organization,
  Function as FunctionModel,
} from '@tdsk/domain'

import { createStore } from 'jotai'
import { userState } from '@TAF/state/user'
import { providersState } from '@TAF/state/providers'
import { quickstartState } from '@TAF/state/quickstart'
import { themeTypeState, defThemeType } from '@TAF/state/theme'
import {
  defSidebarOpen,
  sidebarOpenState,
  defActiveRailSection,
  activeRailSectionState,
} from '@TAF/state/app'
import { orgQuotaState, orgLimitsState } from '@TAF/state/quotas'
import { assetsState, activeAssetIdState } from '@TAF/state/assets'
import { agentsState, activeAgentIdState } from '@TAF/state/agents'
import { domainsState, activeDomainIdState } from '@TAF/state/domains'
import { apiKeysState, activeApiKeyIdState } from '@TAF/state/apiKeys'
import { threadsState, activeThreadIdState } from '@TAF/state/threads'
import { messagesState, activeMessageIdState } from '@TAF/state/messages'
import { projectsState, activeProjectIdState } from '@TAF/state/projects'
import { functionsState, activeFunctionIdState } from '@TAF/state/functions'
import { paymentPlansState, subscriptionState } from '@TAF/state/subscriptions'
import { DefFaasState, DefProxyState, DefAgentState } from '@TAF/constants/endpoints'
import {
  secretsState,
  activeSecretIdState,
  orgSecretsState,
  activeOrgSecretIdState,
} from '@TAF/state/secrets'
import {
  faasFormState,
  proxyFormState,
  agentFormState,
  endpointsState,
  activeEndpointIdState,
} from '@TAF/state/endpoints'
import {
  orgsState,
  orgUsersState,
  activeOrgIdState,
  activeOrgRoleState,
} from '@TAF/state/orgs'

export const store = createStore()

export const getThemeType = () => store.get(themeTypeState)
export const resetThemeType = () => store.set(themeTypeState, defThemeType)
export const setThemeType = (type: EThemeType) => store.set(themeTypeState, type)

export const getSidebarOpen = () => store.get(sidebarOpenState)
export const resetSidebarOpen = () => store.set(sidebarOpenState, defSidebarOpen)
export const setSidebarOpen = (status: boolean) => store.set(sidebarOpenState, status)

export const getActiveRailSection = () => store.get(activeRailSectionState)
export const resetActiveRailSection = () =>
  store.set(activeRailSectionState, defActiveRailSection)
export const setActiveRailSection = (id: TRailSectionId | null) =>
  store.set(activeRailSectionState, id)

export const getQuickstartOpen = () => store.get(quickstartState)
export const resetQuickstartOpen = () => store.set(quickstartState, defSidebarOpen)
export const setQuickstartOpen = (status: boolean) => store.set(quickstartState, status)

export const getUser = () => store.get(userState)
export const resetUser = () => store.set(userState, undefined)
export const setUser = (user: User) => store.set(userState, user)

export const getOrgUsers = () => store.get(orgUsersState)
export const resetOrgUsers = () => store.set(orgUsersState, undefined)
export const setOrgUsers = (orgUsers: Record<string, User[]>) =>
  store.set(orgUsersState, orgUsers)

export const getOrgs = () => store.get(orgsState)
export const resetOrgs = () => store.set(orgsState, undefined)
export const setOrgs = (orgs: Record<string, Organization>) => store.set(orgsState, orgs)

export const getActiveOrgId = () => store.get(activeOrgIdState)
export const resetActiveOrgId = () => store.set(activeOrgIdState, undefined)
export const setActiveOrgId = (id: string) => store.set(activeOrgIdState, id)

export const getActiveOrgRole = () => store.get(activeOrgRoleState)
export const resetActiveOrgRole = () => store.set(activeOrgRoleState, undefined)
export const setActiveOrgRole = (role: string) => store.set(activeOrgRoleState, role)

export const getProjects = () => store.get(projectsState)
export const resetProjects = () => store.set(projectsState, undefined)
export const setProjects = (projects: Record<string, Project>) =>
  store.set(projectsState, projects)

export const getActiveProjectId = () => store.get(activeProjectIdState)
export const resetActiveProjectId = () => store.set(activeProjectIdState, undefined)
export const setActiveProjectId = (id: string) => store.set(activeProjectIdState, id)

export const getProviders = () => store.get(providersState)
export const resetProviders = () => store.set(providersState, undefined)
export const setProviders = (providers: Record<string, Provider>) =>
  store.set(providersState, providers)

export const getSecrets = () => store.get(secretsState)
export const resetSecrets = () => store.set(secretsState, undefined)
export const setSecrets = (secrets: Record<string, Record<string, Secret>>) =>
  store.set(secretsState, secrets)

export const getActiveSecretId = () => store.get(activeSecretIdState)
export const resetActiveSecretId = () => store.set(activeSecretIdState, undefined)
export const setActiveSecretId = (id: string) => store.set(activeSecretIdState, id)

export const getOrgSecrets = () => store.get(orgSecretsState)
export const resetOrgSecrets = () => store.set(orgSecretsState, undefined)
export const setOrgSecrets = (secrets: Record<string, Secret>) =>
  store.set(orgSecretsState, secrets)

export const getActiveOrgSecretId = () => store.get(activeOrgSecretIdState)
export const resetActiveOrgSecretId = () => store.set(activeOrgSecretIdState, undefined)
export const setActiveOrgSecretId = (id: string) => store.set(activeOrgSecretIdState, id)

export const getDomains = () => store.get(domainsState)
export const resetDomains = () => store.set(domainsState, undefined)
export const setDomains = (domains: Record<string, Record<string, Domain>>) =>
  store.set(domainsState, domains)

export const getActiveDomainId = () => store.get(activeDomainIdState)
export const resetActiveDomainId = () => store.set(activeDomainIdState, undefined)
export const setActiveDomainId = (id: string) => store.set(activeDomainIdState, id)

export const getEndpoints = () => store.get(endpointsState)
export const resetEndpoints = () => store.set(endpointsState, undefined)
export const setEndpoints = (endpoints: Record<string, Record<string, Endpoint>>) =>
  store.set(endpointsState, endpoints)

export const getActiveEndpointId = () => store.get(activeEndpointIdState)
export const resetActiveEndpointId = () => store.set(activeEndpointIdState, undefined)
export const setActiveEndpointId = (id: string) => store.set(activeEndpointIdState, id)

export const getFunctions = () => store.get(functionsState)
export const resetFunctions = () => store.set(functionsState, undefined)
export const setFunctions = (functions: Record<string, Record<string, FunctionModel>>) =>
  store.set(functionsState, functions)

export const getActiveFunctionId = () => store.get(activeFunctionIdState)
export const resetActiveFunctionId = () => store.set(activeFunctionIdState, undefined)
export const setActiveFunctionId = (id: string) => store.set(activeFunctionIdState, id)

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

export const getSubscription = () => store.get(subscriptionState)
export const resetSubscription = () => store.set(subscriptionState, null)
export const setSubscription = (subscription: Subscription | null) =>
  store.set(subscriptionState, subscription)

export const getPaymentPlans = () => store.get(paymentPlansState)
export const resetPaymentPlans = () => store.set(paymentPlansState, [])
export const setPaymentPlans = (plans: Plan[]) => store.set(paymentPlansState, plans)

export const getOrgQuota = () => store.get(orgQuotaState)
export const resetOrgQuota = () => store.set(orgQuotaState, undefined)
export const setOrgQuota = (quota: TQuotaData | undefined) =>
  store.set(orgQuotaState, quota)

export const getOrgLimits = () => store.get(orgLimitsState)
export const resetOrgLimits = () => store.set(orgLimitsState, undefined)
export const setOrgLimits = (limits: TLimitsData | undefined) =>
  store.set(orgLimitsState, limits)

export const getThreads = () => store.get(threadsState)
export const resetThreads = () => store.set(threadsState, undefined)
export const setThreads = (threads: Record<string, Record<string, Thread>>) =>
  store.set(threadsState, threads)

export const getActiveThreadId = () => store.get(activeThreadIdState)
export const resetActiveThreadId = () => store.set(activeThreadIdState, undefined)
export const setActiveThreadId = (id: string) => store.set(activeThreadIdState, id)

export const getMessages = () => store.get(messagesState)
export const resetMessages = () => store.set(messagesState, undefined)
export const setMessages = (messages: Record<string, Record<string, Message>>) =>
  store.set(messagesState, messages)

export const getActiveMessageId = () => store.get(activeMessageIdState)
export const resetActiveMessageId = () => store.set(activeMessageIdState, undefined)
export const setActiveMessageId = (id: string) => store.set(activeMessageIdState, id)

export const getAssets = () => store.get(assetsState)
export const resetAssets = () => store.set(assetsState, undefined)
export const setAssets = (assets: Record<string, Record<string, Asset>>) =>
  store.set(assetsState, assets)

export const getActiveAssetId = () => store.get(activeAssetIdState)
export const resetActiveAssetId = () => store.set(activeAssetIdState, undefined)
export const setActiveAssetId = (id: string) => store.set(activeAssetIdState, id)

export const getAgents = () => store.get(agentsState)
export const resetAgents = () => store.set(agentsState, undefined)
export const setAgents = (agents: Record<string, Record<string, Agent>>) =>
  store.set(agentsState, agents)

export const getActiveAgentId = () => store.get(activeAgentIdState)
export const resetActiveAgentId = () => store.set(activeAgentIdState, undefined)
export const setActiveAgentId = (id: string) => store.set(activeAgentIdState, id)

// Endpoint Form State Accessors
export const getProxyFormState = () => store.get(proxyFormState)
export const resetProxyFormState = () => store.set(proxyFormState, DefProxyState)
export const setProxyFormState = (state: TProxyFormState) =>
  store.set(proxyFormState, state)

export const getFaasFormState = () => store.get(faasFormState)
export const resetFaasFormState = () => store.set(faasFormState, DefFaasState)
export const setFaasFormState = (state: TFaasFormState) => store.set(faasFormState, state)

export const getAgentFormState = () => store.get(agentFormState)
export const resetAgentFormState = () => store.set(agentFormState, DefAgentState)
export const setAgentFormState = (state: TAgentFormState) =>
  store.set(agentFormState, state)

// --- Scope-keyed accessors ---

// Project-keyed: endpoints, functions, secrets
export const getProjectEndpoints = (projectId: string) => getEndpoints()?.[projectId]
export const setProjectEndpoints = (projectId: string, eps: Record<string, Endpoint>) => {
  const all = getEndpoints() || {}
  setEndpoints({ ...all, [projectId]: eps })
}

export const getProjectFunctions = (projectId: string) => getFunctions()?.[projectId]
export const setProjectFunctions = (
  projectId: string,
  fns: Record<string, FunctionModel>
) => {
  const all = getFunctions() || {}
  setFunctions({ ...all, [projectId]: fns })
}

export const getProjectSecrets = (projectId: string) => getSecrets()?.[projectId]
export const setProjectSecrets = (projectId: string, secs: Record<string, Secret>) => {
  const all = getSecrets() || {}
  setSecrets({ ...all, [projectId]: secs })
}

// Context-keyed: agents, domains, threads, assets
export const getContextAgents = (key: string) => getAgents()?.[key]
export const setContextAgents = (key: string, agents: Record<string, Agent>) => {
  const all = getAgents() || {}
  setAgents({ ...all, [key]: agents })
}

export const getContextDomains = (key: string) => getDomains()?.[key]
export const setContextDomains = (key: string, domains: Record<string, Domain>) => {
  const all = getDomains() || {}
  setDomains({ ...all, [key]: domains })
}

export const getContextThreads = (key: string) => getThreads()?.[key]
export const setContextThreads = (key: string, threads: Record<string, Thread>) => {
  const all = getThreads() || {}
  setThreads({ ...all, [key]: threads })
}

export const getContextAssets = (key: string) => getAssets()?.[key]
export const setContextAssets = (key: string, assets: Record<string, Asset>) => {
  const all = getAssets() || {}
  setAssets({ ...all, [key]: assets })
}

// Thread-keyed: messages
export const getThreadMessages = (threadId: string) => getMessages()?.[threadId]
export const setThreadMessages = (threadId: string, msgs: Record<string, Message>) => {
  const all = getMessages() || {}
  setMessages({ ...all, [threadId]: msgs })
}
