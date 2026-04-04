import type { Atom } from 'jotai'
import type { atomWithReset } from 'jotai/utils'
import type {
  Role,
  Agent,
  Asset,
  Domain,
  Secret,
  Thread,
  Project,
  Message,
  Endpoint,
  Organization,
  Function as FunctionModel,
} from '@tdsk/domain'

import { useAtom } from 'jotai'
import { useResetAtom } from 'jotai/utils'
import { userState } from '@TAF/state/user'
import { noOp } from '@keg-hub/jsutils/noOp'
import { themeTypeState } from '@TAF/state/theme'
import { apiKeysState } from '@TAF/state/apiKeys'
import { providersState } from '@TAF/state/providers'
import { sandboxesState } from '@TAF/state/sandboxes'
import { quickstartState } from '@TAF/state/quickstart'
import { orgQuotaState, orgLimitsState } from '@TAF/state/quotas'
import { sidebarOpenState, activeRailSectionState } from '@TAF/state/app'
import {
  assetsState,
  activeAssetIdState,
  orgAssetsState,
  projectAssetsState,
} from '@TAF/state/assets'
import { skillsState, activeSkillIdState } from '@TAF/state/skills'
import { schedulesState, activeScheduleIdState } from '@TAF/state/schedules'
import { projectMembersState, activeProjectMembersState } from '@TAF/state/projectMembers'
import {
  domainsState,
  activeDomainIdState,
  orgDomainsState,
  projectDomainsState,
} from '@TAF/state/domains'
import {
  threadsState,
  activeThreadIdState,
  activeThreadState,
  orgThreadsState,
  projectThreadsState,
} from '@TAF/state/threads'
import {
  messagesState,
  activeMessageIdState,
  threadMessagesState,
} from '@TAF/state/messages'
import {
  functionsState,
  activeFunctionIdState,
  projectFunctionsState,
} from '@TAF/state/functions'
import { invoicesState } from '@TAF/state/invoices'
import { paymentPlansState, subscriptionState } from '@TAF/state/subscriptions'
import {
  agentsState,
  activeAgentIdState,
  activeAgentState,
  orgAgentsState,
  projectAgentsState,
} from '@TAF/state/agents'
import {
  secretsState,
  activeSecretIdState,
  orgSecretsState,
  activeOrgSecretIdState,
  projectSecretsState,
} from '@TAF/state/secrets'
import {
  faasFormState,
  proxyFormState,
  agentFormState,
  endpointsState,
  activeEndpointState,
  projectEndpointsState,
  activeEndpointIdState,
  endpointTabsDisabledState,
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
export const useSandboxes = () => useRecState(sandboxesState)
export const useThemeType = () => useRecState(themeTypeState)
export const useSidebarOpen = () => useRecState(sidebarOpenState)
export const useQuickstartOpen = () => useRecState(quickstartState)
export const useActiveRailSection = () => useRecState(activeRailSectionState)

export const useOrgs = () => useRecState(orgsState)
export const useOrgUsers = () => useRecState(orgUsersState)

export const useActiveOrgId = () => useRecState(activeOrgIdState)
export const useActiveOrgRole = () =>
  useDerivedState<string | undefined>(activeOrgRoleState)
export const useActiveOrg = () => useDerivedState<Organization>(activeOrgState)

export const useProjects = () => useRecState(projectsState)
export const useActiveProjectId = () => useRecState(activeProjectIdState)
export const useActiveProject = () => useDerivedState<Project>(activeProjectState)

export const useSecrets = () => useRecState(secretsState)
export const useActiveSecretId = () => useRecState(activeSecretIdState)

export const useOrgSecrets = () =>
  useDerivedState<Record<string, Secret>>(orgSecretsState)
export const useActiveOrgSecretId = () => useRecState(activeOrgSecretIdState)

export const useDomains = () => useRecState(domainsState)
export const useActiveDomainId = () => useRecState(activeDomainIdState)

export const useEndpoints = () => useRecState(endpointsState)
export const useActiveEndpointId = () => useRecState(activeEndpointIdState)
export const useEndpointTabsDisabled = () => useRecState(endpointTabsDisabledState)
export const useActiveEndpoint = () => useDerivedState<Endpoint>(activeEndpointState)

export const useFunctions = () => useRecState(functionsState)
export const useActiveFunctionId = () => useRecState(activeFunctionIdState)

export const useApiKeys = () => useRecState(apiKeysState)

export const usePaymentPlans = () => useRecState(paymentPlansState)
export const useSubscription = () => useRecState(subscriptionState)
export const useInvoices = () => useRecState(invoicesState)

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
export const useActiveAgent = () => useDerivedState<Agent>(activeAgentState)

export const useProxyFormState = () => useRecState(proxyFormState)
export const useFaasFormState = () => useRecState(faasFormState)
export const useAgentFormState = () => useRecState(agentFormState)

// Project-scoped derived selectors
export const useProjectEndpoints = () =>
  useDerivedState<Record<string, Endpoint>>(projectEndpointsState)
export const useProjectFunctions = () =>
  useDerivedState<Record<string, FunctionModel>>(projectFunctionsState)
export const useProjectSecrets = () =>
  useDerivedState<Record<string, Secret>>(projectSecretsState)
export const useProjectAgents = () =>
  useDerivedState<Record<string, Agent>>(projectAgentsState)
export const useProjectDomains = () =>
  useDerivedState<Record<string, Domain>>(projectDomainsState)
export const useProjectThreads = () =>
  useDerivedState<Record<string, Thread>>(projectThreadsState)
export const useProjectAssets = () =>
  useDerivedState<Record<string, Asset>>(projectAssetsState)

// Org-scoped derived selectors (for dual-context atoms)
export const useOrgAgents = () => useDerivedState<Record<string, Agent>>(orgAgentsState)
export const useOrgDomains = () =>
  useDerivedState<Record<string, Domain>>(orgDomainsState)
export const useOrgThreads = () =>
  useDerivedState<Record<string, Thread>>(orgThreadsState)
export const useOrgAssets = () => useDerivedState<Record<string, Asset>>(orgAssetsState)

// Org-scoped flat atoms
export const useSkills = () => useRecState(skillsState)
export const useActiveSkillId = () => useRecState(activeSkillIdState)

export const useSchedules = () => useRecState(schedulesState)
export const useActiveScheduleId = () => useRecState(activeScheduleIdState)

// Project-scoped members
export const useProjectMembers = () => useRecState(projectMembersState)
export const useActiveProjectMembers = () =>
  useDerivedState<Record<string, Role>>(activeProjectMembersState)

// Thread-scoped messages
export const useActiveThread = () => useDerivedState<Thread>(activeThreadState)

export const useThreadMessages = () =>
  useDerivedState<Record<string, Message>>(threadMessagesState)
