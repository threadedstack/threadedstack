import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LoaderFunctionArgs } from 'react-router'

// --- Accessor mocks ---
const mockGetOrgs = vi.fn()
const mockGetProjects = vi.fn()
const mockGetProviders = vi.fn()
const mockGetContextSandboxes = vi.fn()
const mockGetSkills = vi.fn()
const mockGetContextSchedules = vi.fn()
const mockGetApiKeys = vi.fn()
const mockGetOrgUsers = vi.fn()
const mockGetOrgSecrets = vi.fn()
const mockGetContextAgents = vi.fn()
const mockGetContextDomains = vi.fn()
const mockGetProjectEndpoints = vi.fn()
const mockGetProjectFunctions = vi.fn()
const mockGetProjectSecrets = vi.fn()
const mockGetProjectMembersForProject = vi.fn()
const mockGetOrgQuota = vi.fn()
const mockGetOrgLimits = vi.fn()
const mockGetContextThreads = vi.fn()
const mockGetProjectMembers = vi.fn()
const mockGetPermissionOverrides = vi.fn()
const mockGetWaitlisted = vi.fn()
const mockSetWaitlisted = vi.fn()
const mockSetActiveOrgId = vi.fn()
const mockSetActiveProjectId = vi.fn()
const mockSetActiveEndpointId = vi.fn()
const mockSetActiveAgentId = vi.fn()
const mockSetActiveThreadId = vi.fn()
const mockGetSubscription = vi.fn()
const mockGetPaymentPlans = vi.fn()
const mockGetInvoices = vi.fn()
const mockResetSubscription = vi.fn()
const mockResetPaymentPlans = vi.fn()
const mockResetInvoices = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  getOrgs: () => mockGetOrgs(),
  getProjects: () => mockGetProjects(),
  getProviders: () => mockGetProviders(),
  getContextSandboxes: (...args: any[]) => mockGetContextSandboxes(...args),
  getSkills: () => mockGetSkills(),
  getContextSchedules: (...args: any[]) => mockGetContextSchedules(...args),
  getApiKeys: () => mockGetApiKeys(),
  getOrgUsers: () => mockGetOrgUsers(),
  getOrgSecrets: () => mockGetOrgSecrets(),
  getContextAgents: (...args: any[]) => mockGetContextAgents(...args),
  getContextDomains: (...args: any[]) => mockGetContextDomains(...args),
  getProjectEndpoints: (...args: any[]) => mockGetProjectEndpoints(...args),
  getProjectFunctions: (...args: any[]) => mockGetProjectFunctions(...args),
  getProjectSecrets: (...args: any[]) => mockGetProjectSecrets(...args),
  getProjectMembersForProject: (...args: any[]) =>
    mockGetProjectMembersForProject(...args),
  getOrgQuota: () => mockGetOrgQuota(),
  getOrgLimits: () => mockGetOrgLimits(),
  getContextThreads: (...args: any[]) => mockGetContextThreads(...args),
  getProjectMembers: () => mockGetProjectMembers(),
  getPermissionOverrides: () => mockGetPermissionOverrides(),
  getWaitlisted: () => mockGetWaitlisted(),
  setWaitlisted: (...args: any[]) => mockSetWaitlisted(...args),
  setActiveOrgId: (...args: any[]) => mockSetActiveOrgId(...args),
  setActiveProjectId: (...args: any[]) => mockSetActiveProjectId(...args),
  setActiveEndpointId: (...args: any[]) => mockSetActiveEndpointId(...args),
  setActiveAgentId: (...args: any[]) => mockSetActiveAgentId(...args),
  setActiveThreadId: (...args: any[]) => mockSetActiveThreadId(...args),
  getSubscription: () => mockGetSubscription(),
  getPaymentPlans: () => mockGetPaymentPlans(),
  getInvoices: () => mockGetInvoices(),
  resetSubscription: () => mockResetSubscription(),
  resetPaymentPlans: () => mockResetPaymentPlans(),
  resetInvoices: () => mockResetInvoices(),
}))

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
const mockToastInfo = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    info: (...args: any[]) => mockToastInfo(...args),
  },
}))

// --- Fetch action mocks ---
const mockFetchOrgs = vi.fn()
const mockFetchOrg = vi.fn()
const mockFetchProjects = vi.fn()
const mockFetchProviders = vi.fn()
const mockFetchSandboxes = vi.fn()
const mockFetchSkills = vi.fn()
const mockFetchSchedules = vi.fn()
const mockFetchApiKeys = vi.fn()
const mockFetchSecrets = vi.fn()
const mockFetchAgents = vi.fn()
const mockFetchDomains = vi.fn()
const mockFetchEndpoints = vi.fn()
const mockFetchFunctions = vi.fn()
const mockFetchOrgQuota = vi.fn()
const mockFetchOrgLimits = vi.fn()
const mockFetchThreads = vi.fn()
const mockListOrgUsers = vi.fn()
const mockListProjectMembers = vi.fn()
const mockFetchOverrides = vi.fn()

vi.mock('@TAF/actions/orgs/api/fetchOrgs', () => ({
  fetchOrgs: () => mockFetchOrgs(),
}))
vi.mock('@TAF/actions/orgs/api/fetchOrg', () => ({
  fetchOrg: (...args: any[]) => mockFetchOrg(...args),
}))
vi.mock('@TAF/actions/projects/api/fetchProjects', () => ({
  fetchProjects: (...args: any[]) => mockFetchProjects(...args),
}))
vi.mock('@TAF/actions/providers/api/fetchProviders', () => ({
  fetchProviders: (...args: any[]) => mockFetchProviders(...args),
}))
vi.mock('@TAF/actions/sandboxes/api/fetchSandboxes', () => ({
  fetchSandboxes: (...args: any[]) => mockFetchSandboxes(...args),
}))
vi.mock('@TAF/actions/skills/api/fetchSkills', () => ({
  fetchSkills: (...args: any[]) => mockFetchSkills(...args),
}))
vi.mock('@TAF/actions/schedules/api/fetchSchedules', () => ({
  fetchSchedules: (...args: any[]) => mockFetchSchedules(...args),
}))
vi.mock('@TAF/actions/apiKeys/api/fetchApiKeys', () => ({
  fetchApiKeys: (...args: any[]) => mockFetchApiKeys(...args),
}))
vi.mock('@TAF/actions/secrets/api/fetchSecrets', () => ({
  fetchSecrets: (...args: any[]) => mockFetchSecrets(...args),
}))
vi.mock('@TAF/actions/agents/api/fetchAgents', () => ({
  fetchAgents: (...args: any[]) => mockFetchAgents(...args),
}))
vi.mock('@TAF/actions/domains/api/fetchDomains', () => ({
  fetchDomains: (...args: any[]) => mockFetchDomains(...args),
}))
vi.mock('@TAF/actions/endpoints/api/fetchEndpoints', () => ({
  fetchEndpoints: (...args: any[]) => mockFetchEndpoints(...args),
}))
vi.mock('@TAF/actions/functions/api/fetchFunctions', () => ({
  fetchFunctions: (...args: any[]) => mockFetchFunctions(...args),
}))
vi.mock('@TAF/actions/quotas/api/fetchOrgQuota', () => ({
  fetchOrgQuota: (...args: any[]) => mockFetchOrgQuota(...args),
}))
vi.mock('@TAF/actions/quotas/api/fetchOrgLimits', () => ({
  fetchOrgLimits: (...args: any[]) => mockFetchOrgLimits(...args),
}))
vi.mock('@TAF/actions/threads/api/fetchThreads', () => ({
  fetchThreads: (...args: any[]) => mockFetchThreads(...args),
}))
vi.mock('@TAF/actions/users/api/listOrgUsers', () => ({
  listOrgUsers: (...args: any[]) => mockListOrgUsers(...args),
}))
vi.mock('@TAF/actions/permissionOverrides/api/fetchOverrides', () => ({
  fetchOverrides: (...args: any[]) => mockFetchOverrides(...args),
}))
vi.mock('@TAF/actions/projectMembers/api/listProjectMembers', () => ({
  listProjectMembers: (...args: any[]) => mockListProjectMembers(...args),
}))

const mockFetchCurrentSubscription = vi.fn()
const mockFetchPaymentPlans = vi.fn()
const mockFetchInvoices = vi.fn()
vi.mock('@TAF/actions/subscriptions/api/fetchCurrentSubscription', () => ({
  fetchCurrentSubscription: () => mockFetchCurrentSubscription(),
}))
vi.mock('@TAF/actions/subscriptions/api/fetchPaymentPlans', () => ({
  fetchPaymentPlans: () => mockFetchPaymentPlans(),
}))
vi.mock('@TAF/actions/subscriptions/api/fetchInvoices', () => ({
  fetchInvoices: () => mockFetchInvoices(),
}))

import {
  rootLoader,
  billingLoader,
  orgScopeLoader,
  orgProvidersLoader,
  orgSecretsLoader,
  orgSandboxesLoader,
  orgDomainsLoader,
  orgAgentsLoader,
  orgSkillsLoader,
  projectSchedulesLoader,
  orgMembersLoader,
  orgApiKeysLoader,
  orgPermissionsLoader,
  orgUsageLoader,
  projectScopeLoader,
  projectEndpointsLoader,
  projectFunctionsLoader,
  projectSecretsLoader,
  projectAgentsLoader,
  projectDomainsLoader,
  projectMembersLoader,
  projectSandboxesLoader,
  projectApiKeysLoader,
  endpointDetailLoader,
  agentDetailLoader,
  threadDetailLoader,
} from './loaders'

const makeArgs = (params: Record<string, string> = {}) =>
  ({
    params,
    request: new Request('http://test'),
  }) as unknown as LoaderFunctionArgs

const makeReqArgs = (url: string) =>
  ({
    params: {},
    request: new Request(url),
  }) as unknown as LoaderFunctionArgs

describe('loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // rootLoader
  // ---------------------------------------------------------------------------
  describe('rootLoader', () => {
    it('should skip fetch when orgs already loaded', async () => {
      mockGetOrgs.mockReturnValue({ org1: {} })

      const result = await rootLoader()

      expect(result).toBeNull()
      expect(mockFetchOrgs).not.toHaveBeenCalled()
    })

    it('should call fetchOrgs when orgs not loaded', async () => {
      mockGetOrgs.mockReturnValue(undefined)
      mockFetchOrgs.mockResolvedValue({ data: {} })

      const result = await rootLoader()

      expect(result).toBeNull()
      expect(mockFetchOrgs).toHaveBeenCalled()
    })

    it('should throw when fetchOrgs returns error', async () => {
      mockGetOrgs.mockReturnValue(undefined)
      const error = new Error('Network failure')
      mockFetchOrgs.mockResolvedValue({ error })

      await expect(rootLoader()).rejects.toThrow(error)
    })
  })

  // ---------------------------------------------------------------------------
  // orgScopeLoader
  // ---------------------------------------------------------------------------
  describe('orgScopeLoader', () => {
    beforeEach(() => {
      mockFetchOrg.mockResolvedValue({ org: { id: 'org-123' } })
    })

    it('should set activeOrgId from params', async () => {
      mockGetProjects.mockReturnValue({ p1: {} })

      await orgScopeLoader(makeArgs({ orgId: 'org-123' }))

      expect(mockSetActiveOrgId).toHaveBeenCalledWith('org-123')
    })

    it('should await fetchOrg with the org ID', async () => {
      await orgScopeLoader(makeArgs({ orgId: 'org-123' }))

      expect(mockFetchOrg).toHaveBeenCalledWith('org-123')
    })

    it('should throw when fetchOrg returns error', async () => {
      const error = new Error('Org fetch failed')
      mockFetchOrg.mockResolvedValue({ error })

      await expect(orgScopeLoader(makeArgs({ orgId: 'org-123' }))).rejects.toThrow(error)
    })

    it('should fetch projects when not loaded', async () => {
      mockGetProjects.mockReturnValue(undefined)
      mockFetchProjects.mockResolvedValue({ data: {} })

      await orgScopeLoader(makeArgs({ orgId: 'org-123' }))

      expect(mockFetchProjects).toHaveBeenCalledWith({ orgId: 'org-123' })
    })

    it('should always fetch projects to handle org switching', async () => {
      mockGetProjects.mockReturnValue({ p1: {} })

      await orgScopeLoader(makeArgs({ orgId: 'org-123' }))

      expect(mockFetchProjects).toHaveBeenCalledWith({ orgId: 'org-123' })
    })

    it('should throw Response(400) when orgId is missing', async () => {
      try {
        await orgScopeLoader(makeArgs({}))
        expect.fail('Should have thrown')
      } catch (thrown) {
        expect(thrown).toBeInstanceOf(Response)
        const resp = thrown as Response
        expect(resp.status).toBe(400)
        expect(await resp.text()).toBe('Organization ID required')
      }
    })

    it('should complete gracefully when fetchProjects returns error', async () => {
      mockGetProjects.mockReturnValue(undefined)
      const error = new Error('Projects fetch failed')
      mockFetchProjects.mockResolvedValue({ error })

      const result = await orgScopeLoader(makeArgs({ orgId: 'org-1' }))
      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // orgProvidersLoader (representative org page loader)
  // ---------------------------------------------------------------------------
  describe('orgProvidersLoader', () => {
    it('should skip fetch when providers and secrets already loaded', async () => {
      mockGetProviders.mockReturnValue({ prov1: {} })
      mockGetOrgSecrets.mockReturnValue({ s1: {} })

      const result = await orgProvidersLoader(makeArgs({ orgId: 'org-1' }))

      expect(result).toBeNull()
      expect(mockFetchProviders).not.toHaveBeenCalled()
      expect(mockFetchSecrets).not.toHaveBeenCalled()
    })

    it('should call fetchProviders and fetchSecrets when not loaded', async () => {
      mockGetProviders.mockReturnValue(undefined)
      mockGetOrgSecrets.mockReturnValue(undefined)
      mockFetchProviders.mockResolvedValue({ data: {} })
      mockFetchSecrets.mockResolvedValue({ data: {} })

      await orgProvidersLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchProviders).toHaveBeenCalledWith({ orgId: 'org-1' })
      expect(mockFetchSecrets).toHaveBeenCalledWith({ orgId: 'org-1' })
    })

    it('should fetch only secrets when providers already loaded', async () => {
      mockGetProviders.mockReturnValue({ prov1: {} })
      mockGetOrgSecrets.mockReturnValue(undefined)
      mockFetchSecrets.mockResolvedValue({ data: {} })

      await orgProvidersLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchProviders).not.toHaveBeenCalled()
      expect(mockFetchSecrets).toHaveBeenCalledWith({ orgId: 'org-1' })
    })

    it('should complete gracefully when fetchProviders returns error', async () => {
      mockGetProviders.mockReturnValue(undefined)
      mockGetOrgSecrets.mockReturnValue({ s1: {} })
      const error = new Error('Providers fetch failed')
      mockFetchProviders.mockResolvedValue({ error })

      const result = await orgProvidersLoader(makeArgs({ orgId: 'org-1' }))
      expect(result).toBeNull()
    })

    it('should throw Response(400) when orgId is missing', async () => {
      try {
        await orgProvidersLoader(makeArgs({}))
        expect.fail('Should have thrown')
      } catch (thrown) {
        expect(thrown).toBeInstanceOf(Response)
        expect((thrown as Response).status).toBe(400)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // orgSecretsLoader
  // ---------------------------------------------------------------------------
  describe('orgSecretsLoader', () => {
    it('should skip fetch when org secrets already loaded', async () => {
      mockGetOrgSecrets.mockReturnValue({ s1: {} })

      await orgSecretsLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSecrets).not.toHaveBeenCalled()
    })

    it('should call fetchSecrets when not loaded', async () => {
      mockGetOrgSecrets.mockReturnValue(undefined)
      mockFetchSecrets.mockResolvedValue({ data: {} })

      await orgSecretsLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSecrets).toHaveBeenCalledWith({ orgId: 'org-1' })
    })

    it('should throw Response(400) when orgId is missing', async () => {
      try {
        await orgSecretsLoader(makeArgs({}))
        expect.fail('Should have thrown')
      } catch (thrown) {
        expect(thrown).toBeInstanceOf(Response)
        expect((thrown as Response).status).toBe(400)
      }
    })

    it('should resolve without waiting for fetchSecrets to settle (fire-and-forget)', async () => {
      mockGetOrgSecrets.mockReturnValue(undefined)
      let resolveFetch: (value: unknown) => void = () => {}
      mockFetchSecrets.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )

      await orgSecretsLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSecrets).toHaveBeenCalledWith({ orgId: 'org-1' })
      resolveFetch({ data: {} })
    })
  })

  // ---------------------------------------------------------------------------
  // orgAgentsLoader (parallel fetch pattern)
  // ---------------------------------------------------------------------------
  describe('orgAgentsLoader', () => {
    it('should skip both fetches when data already loaded', async () => {
      mockGetContextAgents.mockReturnValue({ a1: {} })
      mockGetProviders.mockReturnValue({ p1: {} })

      await orgAgentsLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchAgents).not.toHaveBeenCalled()
      expect(mockFetchProviders).not.toHaveBeenCalled()
    })

    it('should fetch agents and providers in parallel when not loaded', async () => {
      mockGetContextAgents.mockReturnValue(undefined)
      mockGetProviders.mockReturnValue(undefined)
      mockFetchAgents.mockResolvedValue({ data: {} })
      mockFetchProviders.mockResolvedValue({ data: {} })

      await orgAgentsLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchAgents).toHaveBeenCalledWith({ orgId: 'org-1' })
      expect(mockFetchProviders).toHaveBeenCalledWith({ orgId: 'org-1' })
    })

    it('should fetch only agents when providers already loaded', async () => {
      mockGetContextAgents.mockReturnValue(undefined)
      mockGetProviders.mockReturnValue({ p1: {} })
      mockFetchAgents.mockResolvedValue({ data: {} })

      await orgAgentsLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchAgents).toHaveBeenCalled()
      expect(mockFetchProviders).not.toHaveBeenCalled()
    })

    it('should complete gracefully when one of the parallel fetches returns error', async () => {
      mockGetContextAgents.mockReturnValue(undefined)
      mockGetProviders.mockReturnValue({ p1: {} })
      const error = new Error('Agents fetch failed')
      mockFetchAgents.mockResolvedValue({ error })

      const result = await orgAgentsLoader(makeArgs({ orgId: 'org-1' }))
      expect(result).toBeNull()
    })

    it('should throw Response(400) when orgId is missing', async () => {
      try {
        await orgAgentsLoader(makeArgs({}))
        expect.fail('Should have thrown')
      } catch (thrown) {
        expect(thrown).toBeInstanceOf(Response)
        expect((thrown as Response).status).toBe(400)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // orgMembersLoader
  // ---------------------------------------------------------------------------
  describe('orgMembersLoader', () => {
    it('should skip fetch when org users already loaded for this org', async () => {
      mockGetOrgUsers.mockReturnValue({ 'org-1': [{ id: 'u1' }] })

      await orgMembersLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockListOrgUsers).not.toHaveBeenCalled()
    })

    it('should fetch when org users not loaded', async () => {
      mockGetOrgUsers.mockReturnValue(undefined)
      mockListOrgUsers.mockResolvedValue({ data: {} })

      await orgMembersLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockListOrgUsers).toHaveBeenCalledWith('org-1')
    })
  })

  // ---------------------------------------------------------------------------
  // orgPermissionsLoader
  // ---------------------------------------------------------------------------
  describe('orgPermissionsLoader', () => {
    it('should skip both fetches when overrides and users already loaded', async () => {
      mockGetPermissionOverrides.mockReturnValue([{ id: 'o1' }])
      mockGetOrgUsers.mockReturnValue({ 'org-1': [{ id: 'u1' }] })

      const result = await orgPermissionsLoader(makeArgs({ orgId: 'org-1' }))

      expect(result).toBeNull()
      expect(mockFetchOverrides).not.toHaveBeenCalled()
      expect(mockListOrgUsers).not.toHaveBeenCalled()
    })

    it('should fetch overrides and users in parallel when not loaded', async () => {
      mockGetPermissionOverrides.mockReturnValue(undefined)
      mockGetOrgUsers.mockReturnValue(undefined)
      mockFetchOverrides.mockResolvedValue({ data: [] })
      mockListOrgUsers.mockResolvedValue({ data: {} })

      await orgPermissionsLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchOverrides).toHaveBeenCalledWith('org-1')
      expect(mockListOrgUsers).toHaveBeenCalledWith('org-1')
    })

    it('should fetch only overrides when users already loaded', async () => {
      mockGetPermissionOverrides.mockReturnValue(undefined)
      mockGetOrgUsers.mockReturnValue({ 'org-1': [{ id: 'u1' }] })
      mockFetchOverrides.mockResolvedValue({ data: [] })

      await orgPermissionsLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchOverrides).toHaveBeenCalledWith('org-1')
      expect(mockListOrgUsers).not.toHaveBeenCalled()
    })

    it('should complete gracefully when fetchOverrides returns error', async () => {
      mockGetPermissionOverrides.mockReturnValue(undefined)
      mockGetOrgUsers.mockReturnValue({ 'org-1': [{ id: 'u1' }] })
      const error = new Error('Overrides fetch failed')
      mockFetchOverrides.mockResolvedValue({ error })

      const result = await orgPermissionsLoader(makeArgs({ orgId: 'org-1' }))
      expect(result).toBeNull()
    })

    it('should throw Response(400) when orgId is missing', async () => {
      try {
        await orgPermissionsLoader(makeArgs({}))
        expect.fail('Should have thrown')
      } catch (thrown) {
        expect(thrown).toBeInstanceOf(Response)
        expect((thrown as Response).status).toBe(400)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // orgUsageLoader
  // ---------------------------------------------------------------------------
  describe('orgUsageLoader', () => {
    it('should skip both fetches when quota and limits loaded', async () => {
      mockGetOrgQuota.mockReturnValue({ used: 5 })
      mockGetOrgLimits.mockReturnValue({ max: 10 })

      await orgUsageLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchOrgQuota).not.toHaveBeenCalled()
      expect(mockFetchOrgLimits).not.toHaveBeenCalled()
    })

    it('should fetch both when neither loaded', async () => {
      mockGetOrgQuota.mockReturnValue(undefined)
      mockGetOrgLimits.mockReturnValue(undefined)
      mockFetchOrgQuota.mockResolvedValue({ data: {} })
      mockFetchOrgLimits.mockResolvedValue({ data: {} })

      await orgUsageLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchOrgQuota).toHaveBeenCalledWith('org-1')
      expect(mockFetchOrgLimits).toHaveBeenCalledWith('org-1')
    })

    it('should complete gracefully when fetchOrgQuota returns error', async () => {
      mockGetOrgQuota.mockReturnValue(undefined)
      const error = new Error('Quota fetch failed')
      mockFetchOrgQuota.mockResolvedValue({ error })

      const result = await orgUsageLoader(makeArgs({ orgId: 'org-1' }))
      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // billingLoader
  // ---------------------------------------------------------------------------
  describe('billingLoader', () => {
    beforeEach(() => {
      mockGetSubscription.mockReturnValue(undefined)
      mockGetPaymentPlans.mockReturnValue(undefined)
      mockGetInvoices.mockReturnValue(undefined)
      mockFetchCurrentSubscription.mockResolvedValue({ data: { tier: 'free' } })
      mockFetchPaymentPlans.mockResolvedValue({ data: [] })
      mockFetchInvoices.mockResolvedValue({ data: [] })
    })

    it('fires all three fetches and returns null on first load', async () => {
      const result = await billingLoader(makeReqArgs('http://test/billing'))

      expect(result).toBeNull()
      expect(mockFetchCurrentSubscription).toHaveBeenCalledTimes(1)
      expect(mockFetchPaymentPlans).toHaveBeenCalledTimes(1)
      expect(mockFetchInvoices).toHaveBeenCalledTimes(1)
      expect(mockResetSubscription).not.toHaveBeenCalled()
      expect(mockResetPaymentPlans).not.toHaveBeenCalled()
      expect(mockResetInvoices).not.toHaveBeenCalled()
    })

    it('skips fetches when state is already populated', async () => {
      mockGetSubscription.mockReturnValue({ tier: 'pro' })
      mockGetPaymentPlans.mockReturnValue([{ id: 'p1' }])
      mockGetInvoices.mockReturnValue([{ id: 'i1' }])

      await billingLoader(makeReqArgs('http://test/billing'))

      expect(mockFetchCurrentSubscription).not.toHaveBeenCalled()
      expect(mockFetchPaymentPlans).not.toHaveBeenCalled()
      expect(mockFetchInvoices).not.toHaveBeenCalled()
    })

    it('treats empty array as fetched (does not refetch)', async () => {
      mockGetPaymentPlans.mockReturnValue([])
      mockGetInvoices.mockReturnValue([])
      mockGetSubscription.mockReturnValue({ tier: 'free' })

      await billingLoader(makeReqArgs('http://test/billing'))

      expect(mockFetchPaymentPlans).not.toHaveBeenCalled()
      expect(mockFetchInvoices).not.toHaveBeenCalled()
    })

    it('surfaces fetch errors via toast.error per resource', async () => {
      const subErr = new Error('sub down')
      const plansErr = new Error('plans down')
      mockFetchCurrentSubscription.mockResolvedValue({ error: subErr })
      mockFetchPaymentPlans.mockResolvedValue({ error: plansErr })
      mockFetchInvoices.mockResolvedValue({ data: [] })

      const result = await billingLoader(makeReqArgs('http://test/billing'))

      expect(result).toBeNull()
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to load subscription',
        expect.objectContaining({
          id: 'billing-fetch-subscription',
          description: 'sub down',
        })
      )
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to load plans',
        expect.objectContaining({
          id: 'billing-fetch-plans',
          description: 'plans down',
        })
      )
    })

    it('handles ?success=true by toasting, resetting state, and redirecting', async () => {
      const result = await billingLoader(makeReqArgs('http://test/billing?success=true'))

      expect(result).toBeInstanceOf(Response)
      expect((result as Response).status).toBe(302)
      expect((result as Response).headers.get('location')).toBe('/billing')
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Subscription Updated',
        expect.objectContaining({ id: 'billing-success' })
      )
      expect(mockResetSubscription).toHaveBeenCalledTimes(1)
      expect(mockResetPaymentPlans).toHaveBeenCalledTimes(1)
      expect(mockResetInvoices).toHaveBeenCalledTimes(1)
      expect(mockFetchCurrentSubscription).not.toHaveBeenCalled()
    })

    it('handles ?cancelled=true by toasting info and redirecting without resets', async () => {
      const result = await billingLoader(
        makeReqArgs('http://test/billing?cancelled=true')
      )

      expect(result).toBeInstanceOf(Response)
      expect((result as Response).status).toBe(302)
      expect((result as Response).headers.get('location')).toBe('/billing')
      expect(mockToastInfo).toHaveBeenCalledWith(
        'Checkout Cancelled',
        expect.objectContaining({ id: 'billing-cancelled' })
      )
      expect(mockResetSubscription).not.toHaveBeenCalled()
      expect(mockResetPaymentPlans).not.toHaveBeenCalled()
      expect(mockResetInvoices).not.toHaveBeenCalled()
      expect(mockFetchCurrentSubscription).not.toHaveBeenCalled()
    })

    it('treats success as taking precedence over cancelled', async () => {
      await billingLoader(makeReqArgs('http://test/billing?success=true&cancelled=true'))

      expect(mockToastSuccess).toHaveBeenCalled()
      expect(mockToastInfo).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // projectScopeLoader
  // ---------------------------------------------------------------------------
  describe('projectScopeLoader', () => {
    it('should set activeOrgId and activeProjectId from params', async () => {
      mockGetProjects.mockReturnValue({ p1: {} })

      await projectScopeLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockSetActiveOrgId).toHaveBeenCalledWith('org-1')
      expect(mockSetActiveProjectId).toHaveBeenCalledWith('proj-1')
    })

    it('should fetch projects when not loaded', async () => {
      mockGetProjects.mockReturnValue(undefined)
      mockFetchProjects.mockResolvedValue({ data: {} })

      await projectScopeLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockFetchProjects).toHaveBeenCalledWith({ orgId: 'org-1' })
    })

    it('should skip fetch when projects already loaded', async () => {
      mockGetProjects.mockReturnValue({ p1: {} })

      await projectScopeLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockFetchProjects).not.toHaveBeenCalled()
    })

    it('should complete gracefully when fetchProjects returns error', async () => {
      mockGetProjects.mockReturnValue(undefined)
      const error = new Error('Projects fetch failed')
      mockFetchProjects.mockResolvedValue({ error })

      const result = await projectScopeLoader(
        makeArgs({ orgId: 'org-1', projectId: 'proj-1' })
      )
      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // endpointDetailLoader
  // ---------------------------------------------------------------------------
  describe('endpointDetailLoader', () => {
    const detailParams = { orgId: 'org-1', projectId: 'proj-1', endpointId: 'ep-1' }

    it('should set activeEndpointId from params', async () => {
      mockGetProjectEndpoints.mockReturnValue({ ep1: {} })
      mockGetProviders.mockReturnValue({ p1: {} })
      mockGetOrgSecrets.mockReturnValue({ s1: {} })
      mockGetProjectSecrets.mockReturnValue({ s2: {} })
      mockGetProjectFunctions.mockReturnValue({ f1: {} })
      mockGetContextAgents.mockReturnValue({ a1: {} })

      await endpointDetailLoader(makeArgs(detailParams))

      expect(mockSetActiveEndpointId).toHaveBeenCalledWith('ep-1')
    })

    it('should skip all fetches when all data is loaded', async () => {
      mockGetProjectEndpoints.mockReturnValue({ ep1: {} })
      mockGetProviders.mockReturnValue({ p1: {} })
      mockGetOrgSecrets.mockReturnValue({ s1: {} })
      mockGetProjectSecrets.mockReturnValue({ s2: {} })
      mockGetProjectFunctions.mockReturnValue({ f1: {} })
      mockGetContextAgents.mockReturnValue({ a1: {} })

      await endpointDetailLoader(makeArgs(detailParams))

      expect(mockFetchEndpoints).not.toHaveBeenCalled()
      expect(mockFetchProviders).not.toHaveBeenCalled()
      expect(mockFetchSecrets).not.toHaveBeenCalled()
      expect(mockFetchFunctions).not.toHaveBeenCalled()
      expect(mockFetchAgents).not.toHaveBeenCalled()
    })

    it('should fetch all dependent data in parallel when nothing loaded', async () => {
      mockGetProjectEndpoints.mockReturnValue(undefined)
      mockGetProviders.mockReturnValue(undefined)
      mockGetOrgSecrets.mockReturnValue(undefined)
      mockGetProjectSecrets.mockReturnValue(undefined)
      mockGetProjectFunctions.mockReturnValue(undefined)
      mockGetContextAgents.mockReturnValue(undefined)

      mockFetchEndpoints.mockResolvedValue({ data: {} })
      mockFetchProviders.mockResolvedValue({ data: {} })
      mockFetchSecrets.mockResolvedValue({ data: {} })
      mockFetchFunctions.mockResolvedValue({ data: {} })
      mockFetchAgents.mockResolvedValue({ data: {} })

      await endpointDetailLoader(makeArgs(detailParams))

      expect(mockFetchEndpoints).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
      expect(mockFetchProviders).toHaveBeenCalledWith({ orgId: 'org-1' })
      // fetchSecrets is called twice: once for org secrets, once for project secrets
      expect(mockFetchSecrets).toHaveBeenCalledWith({ orgId: 'org-1' })
      expect(mockFetchSecrets).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
      expect(mockFetchFunctions).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
      expect(mockFetchAgents).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
    })

    it('should complete gracefully when any parallel fetch returns error', async () => {
      mockGetProjectEndpoints.mockReturnValue(undefined)
      mockGetProviders.mockReturnValue({ p1: {} })
      mockGetOrgSecrets.mockReturnValue({ s1: {} })
      mockGetProjectSecrets.mockReturnValue({ s2: {} })
      mockGetProjectFunctions.mockReturnValue({ f1: {} })
      mockGetContextAgents.mockReturnValue({ a1: {} })

      const error = new Error('Endpoints fetch failed')
      mockFetchEndpoints.mockResolvedValue({ error })

      const result = await endpointDetailLoader(makeArgs(detailParams))
      expect(result).toBeNull()
    })

    it('should return null on success', async () => {
      mockGetProjectEndpoints.mockReturnValue({ ep1: {} })
      mockGetProviders.mockReturnValue({ p1: {} })
      mockGetOrgSecrets.mockReturnValue({ s1: {} })
      mockGetProjectSecrets.mockReturnValue({ s2: {} })
      mockGetProjectFunctions.mockReturnValue({ f1: {} })
      mockGetContextAgents.mockReturnValue({ a1: {} })

      const result = await endpointDetailLoader(makeArgs(detailParams))

      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // agentDetailLoader
  // ---------------------------------------------------------------------------
  describe('agentDetailLoader', () => {
    const detailParams = { orgId: 'org-1', projectId: 'proj-1', agentId: 'agent-1' }

    it('should set activeAgentId from params', async () => {
      mockGetContextAgents.mockReturnValue({ a1: {} })
      mockGetProviders.mockReturnValue({ p1: {} })
      mockGetOrgSecrets.mockReturnValue({ s1: {} })
      mockGetProjectSecrets.mockReturnValue({ s2: {} })
      mockGetProjectFunctions.mockReturnValue({ f1: {} })

      await agentDetailLoader(makeArgs(detailParams))

      expect(mockSetActiveAgentId).toHaveBeenCalledWith('agent-1')
    })

    it('should skip all fetches when all data is loaded', async () => {
      mockGetContextAgents.mockReturnValue({ a1: {} })
      mockGetProviders.mockReturnValue({ p1: {} })
      mockGetOrgSecrets.mockReturnValue({ s1: {} })
      mockGetProjectSecrets.mockReturnValue({ s2: {} })
      mockGetProjectFunctions.mockReturnValue({ f1: {} })

      await agentDetailLoader(makeArgs(detailParams))

      expect(mockFetchAgents).not.toHaveBeenCalled()
      expect(mockFetchProviders).not.toHaveBeenCalled()
      expect(mockFetchSecrets).not.toHaveBeenCalled()
      expect(mockFetchFunctions).not.toHaveBeenCalled()
    })

    it('should fetch all dependent data in parallel when nothing loaded', async () => {
      mockGetContextAgents.mockReturnValue(undefined)
      mockGetProviders.mockReturnValue(undefined)
      mockGetOrgSecrets.mockReturnValue(undefined)
      mockGetProjectSecrets.mockReturnValue(undefined)
      mockGetProjectFunctions.mockReturnValue(undefined)

      mockFetchAgents.mockResolvedValue({ data: {} })
      mockFetchProviders.mockResolvedValue({ data: {} })
      mockFetchSecrets.mockResolvedValue({ data: {} })
      mockFetchFunctions.mockResolvedValue({ data: {} })

      await agentDetailLoader(makeArgs(detailParams))

      expect(mockFetchAgents).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
      expect(mockFetchProviders).toHaveBeenCalledWith({ orgId: 'org-1' })
      expect(mockFetchSecrets).toHaveBeenCalledWith({ orgId: 'org-1' })
      expect(mockFetchSecrets).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
      expect(mockFetchFunctions).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
    })

    it('should complete gracefully when any parallel fetch returns error', async () => {
      mockGetContextAgents.mockReturnValue(undefined)
      mockGetProviders.mockReturnValue({ p1: {} })
      mockGetOrgSecrets.mockReturnValue({ s1: {} })
      mockGetProjectSecrets.mockReturnValue({ s2: {} })
      mockGetProjectFunctions.mockReturnValue({ f1: {} })

      const error = new Error('Agents fetch failed')
      mockFetchAgents.mockResolvedValue({ error })

      const result = await agentDetailLoader(makeArgs(detailParams))
      expect(result).toBeNull()
    })

    it('should return null on success', async () => {
      mockGetContextAgents.mockReturnValue({ a1: {} })
      mockGetProviders.mockReturnValue({ p1: {} })
      mockGetOrgSecrets.mockReturnValue({ s1: {} })
      mockGetProjectSecrets.mockReturnValue({ s2: {} })
      mockGetProjectFunctions.mockReturnValue({ f1: {} })

      const result = await agentDetailLoader(makeArgs(detailParams))

      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // threadDetailLoader
  // ---------------------------------------------------------------------------
  describe('threadDetailLoader', () => {
    it('should set activeThreadId when threadId param present', async () => {
      await threadDetailLoader(makeArgs({ threadId: 'thread-1' }))

      expect(mockSetActiveThreadId).toHaveBeenCalledWith('thread-1')
    })

    it('should not set activeThreadId when threadId param missing', async () => {
      await threadDetailLoader(makeArgs({}))

      expect(mockSetActiveThreadId).not.toHaveBeenCalled()
    })

    it('should return null', async () => {
      const result = await threadDetailLoader(makeArgs({ threadId: 'thread-1' }))

      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // orgSandboxesLoader
  // ---------------------------------------------------------------------------
  describe('orgSandboxesLoader', () => {
    it('should skip fetch when sandboxes already loaded', async () => {
      mockGetContextSandboxes.mockReturnValue({ sb1: {} })
      mockGetProviders.mockReturnValue({ p1: {} })

      await orgSandboxesLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSandboxes).not.toHaveBeenCalled()
      expect(mockGetContextSandboxes).toHaveBeenCalledWith('org')
    })

    it('should call fetchSandboxes when not loaded', async () => {
      mockGetContextSandboxes.mockReturnValue(undefined)
      mockGetProviders.mockReturnValue({ p1: {} })
      mockFetchSandboxes.mockResolvedValue({ data: {} })

      await orgSandboxesLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSandboxes).toHaveBeenCalledWith({ orgId: 'org-1' })
      expect(mockGetContextSandboxes).toHaveBeenCalledWith('org')
    })

    it('should fetch providers when not loaded', async () => {
      mockGetContextSandboxes.mockReturnValue({ sb1: {} })
      mockGetProviders.mockReturnValue(undefined)
      mockFetchProviders.mockResolvedValue({ data: {} })

      await orgSandboxesLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchProviders).toHaveBeenCalledWith({ orgId: 'org-1' })
    })

    it('should skip providers fetch when already loaded', async () => {
      mockGetContextSandboxes.mockReturnValue({ sb1: {} })
      mockGetProviders.mockReturnValue({ p1: {} })

      await orgSandboxesLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchProviders).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // projectSandboxesLoader
  // ---------------------------------------------------------------------------
  describe('projectSandboxesLoader', () => {
    it('should skip sandboxes fetch when already loaded', async () => {
      mockGetContextSandboxes.mockReturnValue({ sb1: {} })
      mockGetProviders.mockReturnValue({ p1: {} })

      await projectSandboxesLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockFetchSandboxes).not.toHaveBeenCalled()
      expect(mockGetContextSandboxes).toHaveBeenCalledWith('proj-1')
    })

    it('should fetch sandboxes and providers when not loaded', async () => {
      mockGetContextSandboxes.mockReturnValue(undefined)
      mockGetProviders.mockReturnValue(undefined)
      mockFetchSandboxes.mockResolvedValue({ data: {} })
      mockFetchProviders.mockResolvedValue({ data: {} })

      await projectSandboxesLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockFetchSandboxes).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
      expect(mockFetchProviders).toHaveBeenCalledWith({ orgId: 'org-1' })
      expect(mockGetContextSandboxes).toHaveBeenCalledWith('proj-1')
    })

    it('should throw Response(400) when orgId is missing', async () => {
      try {
        await projectSandboxesLoader(makeArgs({ projectId: 'proj-1' }))
        expect.fail('Should have thrown')
      } catch (thrown) {
        expect(thrown).toBeInstanceOf(Response)
        expect((thrown as Response).status).toBe(400)
      }
    })

    it('should throw Response(400) when projectId is missing', async () => {
      try {
        await projectSandboxesLoader(makeArgs({ orgId: 'org-1' }))
        expect.fail('Should have thrown')
      } catch (thrown) {
        expect(thrown).toBeInstanceOf(Response)
        expect((thrown as Response).status).toBe(400)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // orgSkillsLoader
  // ---------------------------------------------------------------------------
  describe('orgSkillsLoader', () => {
    it('should skip fetch when skills already loaded', async () => {
      mockGetSkills.mockReturnValue({ sk1: {} })

      await orgSkillsLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSkills).not.toHaveBeenCalled()
    })

    it('should call fetchSkills with orgId string when not loaded', async () => {
      mockGetSkills.mockReturnValue(undefined)
      mockFetchSkills.mockResolvedValue({ data: {} })

      await orgSkillsLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSkills).toHaveBeenCalledWith('org-1')
    })
  })

  // ---------------------------------------------------------------------------
  // projectSchedulesLoader (parallel fetch)
  // ---------------------------------------------------------------------------
  describe('projectSchedulesLoader', () => {
    it('should fetch schedules and sandboxes in parallel when not loaded', async () => {
      mockGetContextSchedules.mockReturnValue(undefined)
      mockGetContextSandboxes.mockReturnValue(undefined)
      mockFetchSchedules.mockResolvedValue({ data: {} })
      mockFetchSandboxes.mockResolvedValue({ data: {} })

      await projectSchedulesLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockFetchSchedules).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
      expect(mockFetchSandboxes).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
    })

    it('should skip both when already loaded', async () => {
      mockGetContextSchedules.mockReturnValue({ sch1: {} })
      mockGetContextSandboxes.mockReturnValue({ sb1: {} })

      await projectSchedulesLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockFetchSchedules).not.toHaveBeenCalled()
      expect(mockFetchSandboxes).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // projectEndpointsLoader
  // ---------------------------------------------------------------------------
  describe('projectEndpointsLoader', () => {
    it('should skip fetch when project endpoints already loaded', async () => {
      mockGetProjectEndpoints.mockReturnValue({ ep1: {} })

      await projectEndpointsLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockFetchEndpoints).not.toHaveBeenCalled()
    })

    it('should fetch endpoints when not loaded', async () => {
      mockGetProjectEndpoints.mockReturnValue(undefined)
      mockFetchEndpoints.mockResolvedValue({ data: {} })

      await projectEndpointsLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockFetchEndpoints).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
    })
  })

  // ---------------------------------------------------------------------------
  // projectApiKeysLoader (parallel fetch)
  // ---------------------------------------------------------------------------
  describe('projectApiKeysLoader', () => {
    it('should fetch apiKeys and project members in parallel when not loaded', async () => {
      mockGetApiKeys.mockReturnValue(undefined)
      mockGetProjectMembersForProject.mockReturnValue(undefined)
      mockFetchApiKeys.mockResolvedValue({ data: {} })
      mockListProjectMembers.mockResolvedValue({ data: {} })

      await projectApiKeysLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockFetchApiKeys).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
      expect(mockListProjectMembers).toHaveBeenCalledWith({
        orgId: 'org-1',
        projectId: 'proj-1',
      })
    })

    it('should skip both when already loaded', async () => {
      mockGetApiKeys.mockReturnValue({ k1: {} })
      mockGetProjectMembersForProject.mockReturnValue([{ id: 'u1' }])

      await projectApiKeysLoader(makeArgs({ orgId: 'org-1', projectId: 'proj-1' }))

      expect(mockFetchApiKeys).not.toHaveBeenCalled()
      expect(mockListProjectMembers).not.toHaveBeenCalled()
    })
  })
})
