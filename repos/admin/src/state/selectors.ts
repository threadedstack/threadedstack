import type { Atom } from 'jotai'
import type { atomWithReset } from 'jotai/utils'
import type { Organization, Project } from '@tdsk/domain'

import { useAtom } from 'jotai'
import { useResetAtom } from 'jotai/utils'
import { userState } from '@TAF/state/user'
import { noOp } from '@keg-hub/jsutils/noOp'
import { sidebarOpenState } from '@TAF/state/app'
import { themeTypeState } from '@TAF/state/theme'
import { providersState } from '@TAF/state/providers'
import { quickstartState } from '@TAF/state/quickstart'
import { orgQuotaState, orgLimitsState } from '@TAF/state/quotas'
import { assetsState, activeAssetIdState } from '@TAF/state/assets'
import { agentsState, activeAgentIdState } from '@TAF/state/agents'
import { secretsState, activeSecretIdState } from '@TAF/state/secrets'
import { domainsState, activeDomainIdState } from '@TAF/state/domains'
import { apiKeysState, activeApiKeyIdState } from '@TAF/state/apiKeys'
import { threadsState, activeThreadIdState } from '@TAF/state/threads'
import { messagesState, activeMessageIdState } from '@TAF/state/messages'
import { functionsState, activeFunctionIdState } from '@TAF/state/functions'
import { paymentPlansState, subscriptionState } from '@TAF/state/subscriptions'
import {
  faasFormState,
  proxyFormState,
  agentFormState,
  endpointsState,
  activeEndpointIdState,
} from '@TAF/state/endpoints'
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
export const useQuickstartOpen = () => useRecState(quickstartState)

export const useOrgs = () => useRecState(orgsState)
export const useOrgUsers = () => useRecState(orgUsersState)
export const useActiveOrgId = () => useRecState(activeOrgIdState)
export const useActiveOrgRole = () => useRecState(activeOrgRoleState)
export const useActiveOrg = () => useDerivedState<Organization>(activeOrgState)

export const useProjects = () => useRecState(projectsState)
export const useActiveProjectId = () => useRecState(activeProjectIdState)
export const useActiveProject = () => useDerivedState<Project>(activeProjectState)

export const useSecrets = () => useRecState(secretsState)
export const useActiveSecretId = () => useRecState(activeSecretIdState)

export const useDomains = () => useRecState(domainsState)
export const useActiveDomainId = () => useRecState(activeDomainIdState)

export const useEndpoints = () => useRecState(endpointsState)
export const useActiveEndpointId = () => useRecState(activeEndpointIdState)

export const useFunctions = () => useRecState(functionsState)
export const useActiveFunctionId = () => useRecState(activeFunctionIdState)

export const useApiKeys = () => useRecState(apiKeysState)
export const useActiveApiKeyId = () => useRecState(activeApiKeyIdState)

export const usePaymentPlans = () => useRecState(paymentPlansState)
export const useSubscription = () => useRecState(subscriptionState)

export const useOrgQuota = () => useRecState(orgQuotaState)
export const useOrgLimits = () => useRecState(orgLimitsState)

export const useThreads = () => useRecState(threadsState)
export const useActiveThreadId = () => useRecState(activeThreadIdState)

export const useMessages = () => useRecState(messagesState)
export const useActiveMessageId = () => useRecState(activeMessageIdState)

export const useAssets = () => useRecState(assetsState)
export const useActiveAssetId = () => useRecState(activeAssetIdState)

export const useAgents = () => useRecState(agentsState)
export const useActiveAgentId = () => useRecState(activeAgentIdState)

export const useProxyFormState = () => useRecState(proxyFormState)
export const useFaasFormState = () => useRecState(faasFormState)
export const useAgentFormState = () => useRecState(agentFormState)
