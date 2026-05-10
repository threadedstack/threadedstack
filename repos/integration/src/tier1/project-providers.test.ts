import { describe, test, expect, afterAll } from 'vitest'
import { post, put, get, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Project-Provider Linking', () => {
  const ctx = readContext()
  const createdProviderIds: string[] = []
  const createdProjectIds: string[] = []

  afterAll(async () => {
    for (const id of createdProjectIds) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${id}`)
    }
    for (const id of createdProviderIds) {
      await tryDelete(`/orgs/${ctx.orgId}/providers/${id}`)
    }
  })

  let gitProvider1Id = ''
  let gitProvider2Id = ''
  let gitProvider3Id = ''

  test('setup: create git providers for linking tests', async () => {
    const res1 = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
      name: uniqueName('ProjLink GitHub'),
      type: 'git',
      orgId: ctx.orgId,
      brand: 'github',
      options: { repoUrl: 'https://github.com/test/repo1.git', branch: 'main' },
    })
    expect(res1.status).toBe(201)
    gitProvider1Id = res1.data.id
    createdProviderIds.push(gitProvider1Id)

    const res2 = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
      name: uniqueName('ProjLink GitLab'),
      type: 'git',
      orgId: ctx.orgId,
      brand: 'gitlab',
      options: { repoUrl: 'https://gitlab.com/test/repo2.git' },
    })
    expect(res2.status).toBe(201)
    gitProvider2Id = res2.data.id
    createdProviderIds.push(gitProvider2Id)

    const res3 = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
      name: uniqueName('ProjLink Bitbucket'),
      type: 'git',
      orgId: ctx.orgId,
      brand: 'bitbucket',
      options: { repoUrl: 'https://bitbucket.org/test/repo3.git' },
    })
    expect(res3.status).toBe(201)
    gitProvider3Id = res3.data.id
    createdProviderIds.push(gitProvider3Id)
  })

  describe('create project with providerInputs', () => {
    test('POST /projects with providerInputs returns project with providerLinks', async () => {
      if (!gitProvider1Id) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/projects`, {
        name: uniqueName('Project With Providers'),
        orgId: ctx.orgId,
        providerInputs: [{ id: gitProvider1Id }, { id: gitProvider2Id }],
      })

      expect(res.status).toBe(201)
      expect(res.data.id).toBeTruthy()
      createdProjectIds.push(res.data.id)

      expect(res.data.providerLinks).toBeDefined()
      expect(res.data.providerLinks).toHaveLength(2)

      const linkedIds = res.data.providerLinks.map((l: any) => l.provider.id)
      expect(linkedIds).toContain(gitProvider1Id)
      expect(linkedIds).toContain(gitProvider2Id)
    })

    test('POST /projects without providerInputs returns empty providerLinks', async () => {
      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/projects`, {
        name: uniqueName('Project No Providers'),
        orgId: ctx.orgId,
      })

      expect(res.status).toBe(201)
      createdProjectIds.push(res.data.id)

      expect(res.data.providerLinks).toBeDefined()
      expect(res.data.providerLinks).toHaveLength(0)
    })
  })

  describe('update project providerInputs', () => {
    let projectId = ''

    test('setup: create project with one provider', async () => {
      if (!gitProvider1Id) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/projects`, {
        name: uniqueName('Project Update Test'),
        orgId: ctx.orgId,
        providerInputs: [{ id: gitProvider1Id }],
      })
      expect(res.status).toBe(201)
      projectId = res.data.id
      createdProjectIds.push(projectId)
    })

    test('PUT /projects/:id with new providerInputs replaces links', async () => {
      if (!projectId || !gitProvider2Id || !gitProvider3Id) return

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects/${projectId}`,
        { providerInputs: [{ id: gitProvider2Id }, { id: gitProvider3Id }] }
      )

      expect(res.status).toBe(200)
      expect(res.data.providerLinks).toHaveLength(2)

      const linkedIds = res.data.providerLinks.map((l: any) => l.provider.id)
      expect(linkedIds).toContain(gitProvider2Id)
      expect(linkedIds).toContain(gitProvider3Id)
      expect(linkedIds).not.toContain(gitProvider1Id)
    })

    test('PUT /projects/:id with empty providerInputs clears all links', async () => {
      if (!projectId) return

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects/${projectId}`,
        { providerInputs: [] }
      )

      expect(res.status).toBe(200)
      expect(res.data.providerLinks).toHaveLength(0)
    })
  })

  describe('GET project returns linked providers', () => {
    test('GET /projects/:id includes providerLinks with provider data', async () => {
      if (!gitProvider1Id) return

      const createRes = await post<Record<string, any>>(`/orgs/${ctx.orgId}/projects`, {
        name: uniqueName('Project GET Test'),
        orgId: ctx.orgId,
        providerInputs: [{ id: gitProvider1Id }],
      })
      expect(createRes.status).toBe(201)
      createdProjectIds.push(createRes.data.id)

      const getRes = await get<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects/${createRes.data.id}`
      )
      expect(getRes.status).toBe(200)
      expect(getRes.data.providerLinks).toHaveLength(1)
      expect(getRes.data.providerLinks[0].provider.id).toBe(gitProvider1Id)
      expect(getRes.data.providerLinks[0].provider.type).toBe('git')
      expect(getRes.data.providerLinks[0].provider.brand).toBe('github')
    })
  })

  describe('provider type validation on project', () => {
    test('POST /projects rejects auth-type provider', async () => {
      const authProv = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('Auth Provider'),
        type: 'auth',
        orgId: ctx.orgId,
      })
      if (authProv.status !== 201) return
      createdProviderIds.push(authProv.data.id)

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/projects`, {
        name: uniqueName('Project Bad Provider'),
        orgId: ctx.orgId,
        providerInputs: [{ id: authProv.data.id }],
      })

      expect(res.status).toBe(400)
    })
  })
})
