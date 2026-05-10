import { describe, test, expect, afterAll } from 'vitest'
import { post, put, get } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Sandbox Git Provider Flow', () => {
  const ctx = readContext()
  const createdProviderIds: string[] = []
  const createdProjectIds: string[] = []
  const createdSandboxIds: string[] = []

  afterAll(async () => {
    for (const id of createdSandboxIds) {
      await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${id}`)
    }
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
  let projectId = ''

  test('setup: create git providers and project', async () => {
    const p1 = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
      name: uniqueName('SbGit GitHub'),
      type: 'git',
      orgId: ctx.orgId,
      brand: 'github',
      options: { repoUrl: 'https://github.com/test/app.git', branch: 'main' },
    })
    expect(p1.status).toBe(201)
    gitProvider1Id = p1.data.id
    createdProviderIds.push(gitProvider1Id)

    const p2 = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
      name: uniqueName('SbGit GitLab'),
      type: 'git',
      orgId: ctx.orgId,
      brand: 'gitlab',
      options: { repoUrl: 'https://gitlab.com/test/lib.git', branch: 'develop' },
    })
    expect(p2.status).toBe(201)
    gitProvider2Id = p2.data.id
    createdProviderIds.push(gitProvider2Id)

    const p3 = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
      name: uniqueName('SbGit Bitbucket'),
      type: 'git',
      orgId: ctx.orgId,
      brand: 'bitbucket',
      options: { repoUrl: 'https://bitbucket.org/test/config.git' },
    })
    expect(p3.status).toBe(201)
    gitProvider3Id = p3.data.id
    createdProviderIds.push(gitProvider3Id)

    const proj = await post<Record<string, any>>(`/orgs/${ctx.orgId}/projects`, {
      name: uniqueName('SbGit Project'),
      orgId: ctx.orgId,
      providerInputs: [
        { id: gitProvider1Id },
        { id: gitProvider2Id },
        { id: gitProvider3Id },
      ],
    })
    expect(proj.status).toBe(201)
    projectId = proj.data.id
    createdProjectIds.push(projectId)
  })

  describe('create sandbox with git providers', () => {
    test('POST /sandboxes with git providerInputs includes them in response', async () => {
      if (!gitProvider1Id || !projectId) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/sandboxes`, {
        name: uniqueName('Sandbox With Git'),
        orgId: ctx.orgId,
        projectId,
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        providerInputs: [
          { id: gitProvider1Id, projectId },
          { id: gitProvider2Id, projectId },
        ],
      })

      expect(res.status).toBe(201)
      expect(res.data.id).toBeTruthy()
      createdSandboxIds.push(res.data.id)

      const gitLinks = (res.data.providerLinks || []).filter(
        (l: any) => l.provider.type === 'git'
      )
      expect(gitLinks).toHaveLength(2)

      const gitProviderIds = gitLinks.map((l: any) => l.provider.id)
      expect(gitProviderIds).toContain(gitProvider1Id)
      expect(gitProviderIds).toContain(gitProvider2Id)
    })

    test('POST /sandboxes with git type in providerInputs validates correctly', async () => {
      if (!gitProvider1Id) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/sandboxes`, {
        name: uniqueName('Sandbox Git Valid'),
        orgId: ctx.orgId,
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        providerInputs: [{ id: gitProvider1Id }],
      })

      expect(res.status).toBe(201)
      createdSandboxIds.push(res.data.id)
    })
  })

  describe('sandbox with multiple git providers', () => {
    test('sandbox selects 2 of 3 project git providers', async () => {
      if (!gitProvider1Id || !gitProvider2Id || !projectId) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/sandboxes`, {
        name: uniqueName('Sandbox Select 2of3'),
        orgId: ctx.orgId,
        projectId,
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        providerInputs: [
          { id: gitProvider1Id, projectId },
          { id: gitProvider2Id, projectId },
        ],
      })

      expect(res.status).toBe(201)
      createdSandboxIds.push(res.data.id)

      const allLinks = res.data.providerLinks || []
      const gitLinks = allLinks.filter((l: any) => l.provider.type === 'git')
      expect(gitLinks).toHaveLength(2)

      const gitProviderIds = gitLinks.map((l: any) => l.provider.id)
      expect(gitProviderIds).not.toContain(gitProvider3Id)
    })
  })

  describe('update sandbox git providers', () => {
    let sandboxId = ''

    test('setup: create sandbox with 1 git provider', async () => {
      if (!gitProvider1Id || !projectId) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/sandboxes`, {
        name: uniqueName('Sandbox Update Git'),
        orgId: ctx.orgId,
        projectId,
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        providerInputs: [{ id: gitProvider1Id, projectId }],
      })
      expect(res.status).toBe(201)
      sandboxId = res.data.id
      createdSandboxIds.push(sandboxId)
    })

    test('PUT /sandboxes/:id can change git providers', async () => {
      if (!sandboxId || !gitProvider2Id || !gitProvider3Id) return

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
        {
          providerInputs: [
            { id: gitProvider2Id, projectId },
            { id: gitProvider3Id, projectId },
          ],
        }
      )

      expect(res.status).toBe(200)

      const gitLinks = (res.data.providerLinks || []).filter(
        (l: any) => l.provider.type === 'git'
      )
      const gitProviderIds = gitLinks.map((l: any) => l.provider.id)
      expect(gitProviderIds).toContain(gitProvider2Id)
      expect(gitProviderIds).toContain(gitProvider3Id)
      expect(gitProviderIds).not.toContain(gitProvider1Id)
    })
  })

  describe('git provider options persist', () => {
    test('GET /providers/:id returns repoUrl and branch', async () => {
      if (!gitProvider1Id) return

      const res = await get<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers/${gitProvider1Id}`
      )

      expect(res.status).toBe(200)
      expect(res.data.type).toBe('git')
      expect(res.data.brand).toBe('github')
      expect(res.data.options.repoUrl).toBe('https://github.com/test/app.git')
      expect(res.data.options.branch).toBe('main')
    })
  })
})
