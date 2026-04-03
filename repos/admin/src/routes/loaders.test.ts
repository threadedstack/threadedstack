import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LoaderFunctionArgs } from 'react-router'

// --- Accessor mocks ---
const mockGetOrgs = vi.fn()
const mockGetProjects = vi.fn()
const mockGetProviders = vi.fn()
const mockGetSandboxes = vi.fn()
const mockGetSkills = vi.fn()
const mockGetSchedules = vi.fn()
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
const mockSetActiveOrgId = vi.fn()
const mockSetActiveProjectId = vi.fn()
const mockSetActiveEndpointId = vi.fn()
const mockSetActiveAgentId = vi.fn()
const mockSetActiveThreadId = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  getOrgs: () => mockGetOrgs(),
  getProjects: () => mockGetProjects(),
  getProviders: () => mockGetProviders(),
  getSandboxes: () => mockGetSandboxes(),
  getSkills: () => mockGetSkills(),
  getSchedules: () => mockGetSchedules(),
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
  setActiveOrgId: (...args: any[]) => mockSetActiveOrgId(...args),
  setActiveProjectId: (...args: any[]) => mockSetActiveProjectId(...args),
  setActiveEndpointId: (...args: any[]) => mockSetActiveEndpointId(...args),
  setActiveAgentId: (...args: any[]) => mockSetActiveAgentId(...args),
  setActiveThreadId: (...args: any[]) => mockSetActiveThreadId(...args),
}))

// --- Fetch action mocks ---
const mockFetchOrgs = vi.fn()
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

vi.mock('@TAF/actions/orgs/api/fetchOrgs', () => ({
  fetchOrgs: () => mockFetchOrgs(),
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
vi.mock('@TAF/actions/projectMembers/api/listProjectMembers', () => ({
  listProjectMembers: (...args: any[]) => mockListProjectMembers(...args),
}))

import {
  rootLoader,
  orgScopeLoader,
  orgProvidersLoader,
  orgSecretsLoader,
  orgSandboxesLoader,
  orgDomainsLoader,
  orgAgentsLoader,
  orgSkillsLoader,
  orgSchedulesLoader,
  orgMembersLoader,
  orgApiKeysLoader,
  orgUsageLoader,
  projectScopeLoader,
  projectEndpointsLoader,
  projectFunctionsLoader,
  projectSecretsLoader,
  projectAgentsLoader,
  projectDomainsLoader,
  projectMembersLoader,
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
    it('should set activeOrgId from params', async () => {
      mockGetProjects.mockReturnValue({ p1: {} })

      await orgScopeLoader(makeArgs({ orgId: 'org-123' }))

      expect(mockSetActiveOrgId).toHaveBeenCalledWith('org-123')
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
    it('should skip fetch when providers already loaded', async () => {
      mockGetProviders.mockReturnValue({ prov1: {} })

      const result = await orgProvidersLoader(makeArgs({ orgId: 'org-1' }))

      expect(result).toBeNull()
      expect(mockFetchProviders).not.toHaveBeenCalled()
    })

    it('should call fetchProviders when not loaded', async () => {
      mockGetProviders.mockReturnValue(undefined)
      mockFetchProviders.mockResolvedValue({ data: {} })

      await orgProvidersLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchProviders).toHaveBeenCalledWith({ orgId: 'org-1' })
    })

    it('should complete gracefully when fetchProviders returns error', async () => {
      mockGetProviders.mockReturnValue(undefined)
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
      mockGetSandboxes.mockReturnValue({ sb1: {} })

      await orgSandboxesLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSandboxes).not.toHaveBeenCalled()
    })

    it('should call fetchSandboxes when not loaded', async () => {
      mockGetSandboxes.mockReturnValue(undefined)
      mockFetchSandboxes.mockResolvedValue({ data: {} })

      await orgSandboxesLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSandboxes).toHaveBeenCalledWith({ orgId: 'org-1' })
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
  // orgSchedulesLoader (parallel fetch)
  // ---------------------------------------------------------------------------
  describe('orgSchedulesLoader', () => {
    it('should fetch schedules and agents in parallel when not loaded', async () => {
      mockGetSchedules.mockReturnValue(undefined)
      mockGetContextAgents.mockReturnValue(undefined)
      mockFetchSchedules.mockResolvedValue({ data: {} })
      mockFetchAgents.mockResolvedValue({ data: {} })

      await orgSchedulesLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSchedules).toHaveBeenCalledWith('org-1')
      expect(mockFetchAgents).toHaveBeenCalledWith({ orgId: 'org-1' })
    })

    it('should skip both when already loaded', async () => {
      mockGetSchedules.mockReturnValue({ sch1: {} })
      mockGetContextAgents.mockReturnValue({ a1: {} })

      await orgSchedulesLoader(makeArgs({ orgId: 'org-1' }))

      expect(mockFetchSchedules).not.toHaveBeenCalled()
      expect(mockFetchAgents).not.toHaveBeenCalled()
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
