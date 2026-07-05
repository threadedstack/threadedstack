import type { LoaderFunctionArgs } from 'react-router'

import { toast } from 'sonner'
import { redirect } from 'react-router'
import { WaitlistedCode, isFeatureEnabled } from '@tdsk/domain'
import { fetchOrg } from '@TAF/actions/orgs/api/fetchOrg'
import { fetchOrgs } from '@TAF/actions/orgs/api/fetchOrgs'
import { fetchSkills } from '@TAF/actions/skills/api/fetchSkills'
import { fetchSkillProposals } from '@TAF/actions/skillProposals/api/fetchSkillProposals'
import { fetchTaskProposals } from '@TAF/actions/taskProposals/api/fetchTaskProposals'
import { fetchEscalations } from '@TAF/actions/escalations/api/fetchEscalations'
import { fetchVerifications } from '@TAF/actions/verifications/api/fetchVerifications'
import { fetchAgents } from '@TAF/actions/agents/api/fetchAgents'
import { listOrgUsers } from '@TAF/actions/users/api/listOrgUsers'
import { fetchApiKeys } from '@TAF/actions/apiKeys/api/fetchApiKeys'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'
import { fetchDomains } from '@TAF/actions/domains/api/fetchDomains'
import { fetchThreads } from '@TAF/actions/threads/api/fetchThreads'
import { fetchInvoices } from '@TAF/actions/subscriptions/api/fetchInvoices'
import { fetchOrgQuota } from '@TAF/actions/quotas/api/fetchOrgQuota'
import { fetchOrgLimits } from '@TAF/actions/quotas/api/fetchOrgLimits'
import { fetchProjects } from '@TAF/actions/projects/api/fetchProjects'
import { fetchProviders } from '@TAF/actions/providers/api/fetchProviders'
import { fetchSandboxes } from '@TAF/actions/sandboxes/api/fetchSandboxes'
import { fetchSchedules } from '@TAF/actions/schedules/api/fetchSchedules'
import { fetchEndpoints } from '@TAF/actions/endpoints/api/fetchEndpoints'
import { fetchFunctions } from '@TAF/actions/functions/api/fetchFunctions'
import { fetchOverrides } from '@TAF/actions/permissionOverrides/api/fetchOverrides'
import { fetchPaymentPlans } from '@TAF/actions/subscriptions/api/fetchPaymentPlans'
import { listProjectMembers } from '@TAF/actions/projectMembers/api/listProjectMembers'
import { fetchCurrentSubscription } from '@TAF/actions/subscriptions/api/fetchCurrentSubscription'
import {
  getOrgs,
  getSkills,
  getApiKeys,
  getSkillProposals,
  getTaskProposals,
  getEscalations,
  getVerifications,
  getInvoices,
  getOrgUsers,
  getOrgQuota,
  getProjects,
  getProviders,
  getOrgLimits,
  getWaitlisted,
  setWaitlisted,
  getOrgSecrets,
  resetInvoices,
  setActiveOrgId,
  setActiveAgentId,
  getSubscription,
  getPaymentPlans,
  resetSubscription,
  getContextAgents,
  getContextThreads,
  getContextDomains,
  getProjectSecrets,
  setActiveThreadId,
  resetPaymentPlans,
  setActiveProjectId,
  getProjectEndpoints,
  getContextSchedules,
  getProjectFunctions,
  setActiveEndpointId,
  getContextSandboxes,
  getPermissionOverrides,
  getProjectMembersForProject,
} from '@TAF/state/accessors'

/**
 * Critical fetch — throws on error so the route's errorElement renders.
 * Only used for top-level data that the app cannot function without (e.g., orgs).
 */
const criticalFetch = async (fn: () => Promise<{ error?: Error } | any>) => {
  const resp = await fn()
  if (!resp?.error) return

  if (resp.error.code === WaitlistedCode) {
    setWaitlisted(true)
    return
  }

  throw resp.error
}

/**
 * Best-effort fetch for page/detail loaders.
 * Fires the fetch without awaiting — navigation completes immediately and
 * data loads in the background (matching old useEffect fire-and-forget pattern).
 * Components read from Jotai and re-render when data arrives.
 */
const safeFetch = (fn: () => Promise<any>) => {
  fn()?.catch((err: unknown) => {
    console.warn(
      `[Loader] Background fetch failed:`,
      err instanceof Error ? err.message : err
    )
  })
}

// --- Root Loader ---

export const rootLoader = async () => {
  if (getWaitlisted()) return null
  if (!getOrgs()) await criticalFetch(() => fetchOrgs())
  return null
}

const missOrgIdResp = (msg = `Organization ID required`, status = 400) => {
  throw new Response(msg, { status })
}

const missProjIdResp = (msg = `Project ID required`, status = 400) => {
  throw new Response(msg, { status })
}

// --- Org Scope Loader ---

export const orgScopeLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  setActiveOrgId(orgId)
  await criticalFetch(() => fetchOrg(orgId))
  safeFetch(() => fetchProjects({ orgId }))
  return null
}

export const orgDetailLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  await Promise.all([
    !getOrgUsers()?.[orgId] ? safeFetch(() => listOrgUsers(orgId)) : Promise.resolve(),
    !getProviders() ? safeFetch(() => fetchProviders({ orgId })) : Promise.resolve(),
  ])
  return null
}

// --- Org Page Loaders ---

export const orgSecretsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getOrgSecrets()) await safeFetch(() => fetchSecrets({ orgId }))
  return null
}

export const orgProvidersLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getProviders()) safeFetch(() => fetchProviders({ orgId }))
  if (!getOrgSecrets()) safeFetch(() => fetchSecrets({ orgId }))

  return null
}

export const orgSandboxesLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getProviders()) safeFetch(() => fetchProviders({ orgId }))
  if (!getSkills()) safeFetch(() => fetchSkills(orgId))

  if (!getContextSandboxes(`org`)) safeFetch(() => fetchSandboxes({ orgId }))

  return null
}

export const orgDomainsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getContextDomains(`org`)) await safeFetch(() => fetchDomains({ orgId }))
  return null
}

export const orgAgentsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  await Promise.all([
    !getContextAgents('org')
      ? safeFetch(() => fetchAgents({ orgId }))
      : Promise.resolve(),
    !getProviders() ? safeFetch(() => fetchProviders({ orgId })) : Promise.resolve(),
    !getContextSandboxes(`org`)
      ? safeFetch(() => fetchSandboxes({ orgId }))
      : Promise.resolve(),
  ])
  return null
}

export const orgSkillsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getSkills()) await safeFetch(() => fetchSkills(orgId))
  return null
}

export const orgSkillProposalsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getSkillProposals()) await safeFetch(() => fetchSkillProposals({ orgId }))
  return null
}

export const orgTaskProposalsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getTaskProposals()) await safeFetch(() => fetchTaskProposals({ orgId }))
  return null
}

export const orgEscalationsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getEscalations()) await safeFetch(() => fetchEscalations({ orgId }))
  return null
}

export const orgVerificationsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getVerifications()) await safeFetch(() => fetchVerifications({ orgId }))
  return null
}

export const projectSchedulesLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  await Promise.all([
    !getContextSchedules(projectId)
      ? safeFetch(() => fetchSchedules({ orgId, projectId }))
      : Promise.resolve(),
    !getContextSandboxes(projectId)
      ? safeFetch(() => fetchSandboxes({ orgId, projectId }))
      : Promise.resolve(),
    isFeatureEnabled(`agents`) && !getContextAgents(`org`)
      ? safeFetch(() => fetchAgents({ orgId }))
      : Promise.resolve(),
  ])
  return null
}

export const orgMembersLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getOrgUsers()?.[orgId]) await safeFetch(() => listOrgUsers(orgId))
  return null
}

export const orgApiKeysLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  await Promise.all([
    !getApiKeys() ? safeFetch(() => fetchApiKeys({ orgId })) : Promise.resolve(),
    !getOrgUsers()?.[orgId] ? safeFetch(() => listOrgUsers(orgId)) : Promise.resolve(),
  ])
  return null
}

export const orgPermissionsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  await Promise.all([
    !getPermissionOverrides()
      ? safeFetch(() => fetchOverrides(orgId))
      : Promise.resolve(),
    !getOrgUsers()?.[orgId] ? safeFetch(() => listOrgUsers(orgId)) : Promise.resolve(),
  ])
  return null
}

export const orgUsageLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) missOrgIdResp()

  if (!getOrgQuota()) await safeFetch(() => fetchOrgQuota(orgId))
  if (!getOrgLimits()) await safeFetch(() => fetchOrgLimits(orgId))
  return null
}

// --- Billing Page Loader ---

export const billingLoader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const success = url.searchParams.get(`success`) === `true`
  const cancelled = url.searchParams.get(`cancelled`) === `true`

  if (success) {
    toast.success(`Subscription Updated`, {
      id: `billing-success`,
      description: `Your subscription has been successfully updated.`,
    })
    resetSubscription()
    resetPaymentPlans()
    resetInvoices()
    return redirect(`/billing`)
  }

  if (cancelled) {
    toast.info(`Checkout Cancelled`, {
      id: `billing-cancelled`,
      description: `You cancelled the checkout process.`,
    })
    return redirect(`/billing`)
  }

  const reportFetchError = (label: string, err: Error) =>
    toast.error(`Failed to load ${label}`, {
      id: `billing-fetch-${label}`,
      description: err.message,
    })

  await Promise.all([
    getSubscription()
      ? Promise.resolve()
      : fetchCurrentSubscription().then(
          (resp) => resp?.error && reportFetchError(`subscription`, resp.error)
        ),
    getPaymentPlans()
      ? Promise.resolve()
      : fetchPaymentPlans().then(
          (resp) => resp?.error && reportFetchError(`plans`, resp.error)
        ),
    getInvoices()
      ? Promise.resolve()
      : fetchInvoices().then(
          (resp) => resp?.error && reportFetchError(`invoices`, resp.error)
        ),
  ])

  return null
}

// --- Project Scope Loader ---

export const projectScopeLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  setActiveOrgId(orgId)
  setActiveProjectId(projectId)
  if (!getProjects()) await safeFetch(() => fetchProjects({ orgId }))
  return null
}

// --- Project Page Loaders ---

export const projectEndpointsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  await Promise.all([
    !getProjectEndpoints(projectId)
      ? safeFetch(() => fetchEndpoints({ orgId, projectId }))
      : Promise.resolve(),
    !getProviders() ? safeFetch(() => fetchProviders({ orgId })) : Promise.resolve(),
    !getOrgSecrets() ? safeFetch(() => fetchSecrets({ orgId })) : Promise.resolve(),
    !getProjectSecrets(projectId)
      ? safeFetch(() => fetchSecrets({ orgId, projectId }))
      : Promise.resolve(),
    !getProjectFunctions(projectId)
      ? safeFetch(() => fetchFunctions({ orgId, projectId }))
      : Promise.resolve(),
    !getContextAgents(projectId)
      ? safeFetch(() => fetchAgents({ orgId, projectId }))
      : Promise.resolve(),
  ])
  return null
}

export const projectFunctionsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  if (!getProjectFunctions(projectId))
    await safeFetch(() => fetchFunctions({ orgId, projectId }))
  return null
}

export const projectSecretsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  if (!getProjectSecrets(projectId))
    await safeFetch(() => fetchSecrets({ orgId, projectId }))
  return null
}

export const projectAgentsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  await Promise.all([
    !getContextAgents(projectId)
      ? safeFetch(() => fetchAgents({ orgId, projectId }))
      : Promise.resolve(),
    !getContextSandboxes(`org`)
      ? safeFetch(() => fetchSandboxes({ orgId }))
      : Promise.resolve(),
  ])
  return null
}

export const projectDomainsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  if (!getContextDomains(projectId))
    await safeFetch(() => fetchDomains({ orgId, projectId }))
  return null
}

export const projectMembersLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  if (!getProjectMembersForProject(projectId))
    await safeFetch(() => listProjectMembers({ orgId, projectId }))
  return null
}

export const projectSandboxesLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  if (!getProviders()) safeFetch(() => fetchProviders({ orgId }))
  if (!getSkills()) safeFetch(() => fetchSkills(orgId))

  if (!getContextSandboxes(projectId))
    safeFetch(() => fetchSandboxes({ orgId, projectId }))

  return null
}

export const projectApiKeysLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()

  await Promise.all([
    !getApiKeys()
      ? safeFetch(() => fetchApiKeys({ orgId, projectId }))
      : Promise.resolve(),
    !getProjectMembersForProject(projectId)
      ? safeFetch(() => listProjectMembers({ orgId, projectId }))
      : Promise.resolve(),
  ])
  return null
}

// --- Detail Loaders ---

export const endpointDetailLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId, endpointId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()
  if (!endpointId) throw new Response('Endpoint ID required', { status: 400 })

  setActiveEndpointId(endpointId)
  await Promise.all([
    !getProjectEndpoints(projectId)
      ? safeFetch(() => fetchEndpoints({ orgId, projectId }))
      : Promise.resolve(),
    !getProviders() ? safeFetch(() => fetchProviders({ orgId })) : Promise.resolve(),
    !getOrgSecrets() ? safeFetch(() => fetchSecrets({ orgId })) : Promise.resolve(),
    !getProjectSecrets(projectId)
      ? safeFetch(() => fetchSecrets({ orgId, projectId }))
      : Promise.resolve(),
    !getProjectFunctions(projectId)
      ? safeFetch(() => fetchFunctions({ orgId, projectId }))
      : Promise.resolve(),
    !getContextAgents(projectId)
      ? safeFetch(() => fetchAgents({ orgId, projectId }))
      : Promise.resolve(),
  ])
  return null
}

export const agentDetailLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId, agentId } = params
  if (!orgId) missOrgIdResp()
  if (!projectId) missProjIdResp()
  if (!agentId) throw new Response('Agent ID required', { status: 400 })

  setActiveAgentId(agentId)
  await Promise.all([
    !getContextAgents(projectId)
      ? safeFetch(() => fetchAgents({ orgId, projectId }))
      : Promise.resolve(),
    !getProviders() ? safeFetch(() => fetchProviders({ orgId })) : Promise.resolve(),
    !getOrgSecrets() ? safeFetch(() => fetchSecrets({ orgId })) : Promise.resolve(),
    !getProjectSecrets(projectId)
      ? safeFetch(() => fetchSecrets({ orgId, projectId }))
      : Promise.resolve(),
    !getProjectFunctions(projectId)
      ? safeFetch(() => fetchFunctions({ orgId, projectId }))
      : Promise.resolve(),
    !getContextSandboxes(`org`)
      ? safeFetch(() => fetchSandboxes({ orgId }))
      : Promise.resolve(),
  ])
  return null
}

export const projectThreadsLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId, agentId } = params
  if (!orgId || !agentId) return null

  const contextKey = projectId || 'org'
  if (!getContextThreads(contextKey))
    await safeFetch(() => fetchThreads({ orgId, agentId, contextKey }))
  return null
}

export const threadDetailLoader = async ({ params }: LoaderFunctionArgs) => {
  if (params.threadId) setActiveThreadId(params.threadId)
  return null
}
