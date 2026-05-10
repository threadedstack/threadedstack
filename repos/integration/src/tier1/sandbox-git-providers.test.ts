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

  describe('create sandbox with gitProviderInputs', () => {
    test('POST /sandboxes with gitProviderInputs links git providers', async () => {
      if (!gitProvider1Id || !projectId) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/sandboxes`, {
        name: uniqueName('Sandbox With Git'),
        orgId: ctx.orgId,
        projectIds: [projectId],
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        gitProviderInputs: [
          {
            projectId,
            providers: [
              { id: gitProvider1Id },
              { id: gitProvider2Id },
            ],
          },
        ],
      })

      expect(res.status).toBe(201)
      expect(res.data.id).toBeTruthy()
      createdSandboxIds.push(res.data.id)

      expect(Array.isArray(res.data.gitProviderLinks)).toBe(true)
      expect(res.data.gitProviderLinks.length).toBe(2)

      const gitProviderIds = res.data.gitProviderLinks.map((l: any) => l.provider.id)
      expect(gitProviderIds).toContain(gitProvider1Id)
      expect(gitProviderIds).toContain(gitProvider2Id)
    })

    test('POST /sandboxes with git provider in providerInputs rejects with 400', async () => {
      if (!gitProvider1Id) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/sandboxes`, {
        name: uniqueName('Sandbox Git Reject'),
        orgId: ctx.orgId,
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        providerInputs: [{ id: gitProvider1Id }],
      })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })
  })

  describe('sandbox with multiple git providers per project', () => {
    test('sandbox links 2 of 3 project git providers via gitProviderInputs', async () => {
      if (!gitProvider1Id || !gitProvider2Id || !projectId) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/sandboxes`, {
        name: uniqueName('Sandbox Select 2of3'),
        orgId: ctx.orgId,
        projectIds: [projectId],
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        gitProviderInputs: [
          {
            projectId,
            providers: [
              { id: gitProvider1Id },
              { id: gitProvider2Id },
            ],
          },
        ],
      })

      expect(res.status).toBe(201)
      createdSandboxIds.push(res.data.id)

      expect(Array.isArray(res.data.gitProviderLinks)).toBe(true)
      expect(res.data.gitProviderLinks.length).toBe(2)

      const gitProviderIds = res.data.gitProviderLinks.map((l: any) => l.provider.id)
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
        projectIds: [projectId],
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        gitProviderInputs: [
          {
            projectId,
            providers: [{ id: gitProvider1Id }],
          },
        ],
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
          gitProviderInputs: [
            {
              projectId,
              providers: [
                { id: gitProvider2Id },
                { id: gitProvider3Id },
              ],
            },
          ],
        }
      )

      expect(res.status).toBe(200)

      expect(Array.isArray(res.data.gitProviderLinks)).toBe(true)
      const gitProviderIds = res.data.gitProviderLinks.map((l: any) => l.provider.id)
      expect(gitProviderIds).toContain(gitProvider2Id)
      expect(gitProviderIds).toContain(gitProvider3Id)
      expect(gitProviderIds).not.toContain(gitProvider1Id)
    })

    test('GET /sandboxes/:id includes updated gitProviderLinks', async () => {
      if (!sandboxId) return

      const res = await get<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.gitProviderLinks)).toBe(true)
      expect(res.data.gitProviderLinks.length).toBe(2)

      for (const link of res.data.gitProviderLinks) {
        expect(link.provider).toBeDefined()
        expect(link.provider.type).toBe('git')
        expect(typeof link.priority).toBe('number')
      }
    })

    test('PUT /sandboxes/:id with empty gitProviderInputs clears git providers', async () => {
      if (!sandboxId) return

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
        {
          gitProviderInputs: [
            { projectId, providers: [] },
          ],
        }
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.gitProviderLinks)).toBe(true)
      expect(res.data.gitProviderLinks.length).toBe(0)
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

  describe('gitProviderInputs validation', () => {
    test('gitProviderInputs with missing projectId returns 400', async () => {
      if (!gitProvider1Id) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/sandboxes`, {
        name: uniqueName('Sandbox Git NoProjId'),
        orgId: ctx.orgId,
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        gitProviderInputs: [
          { providers: [{ id: gitProvider1Id }] },
        ],
      })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('gitProviderInputs with non-git provider returns 400', async () => {
      if (!projectId) return

      const aiProv = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('SbGit AI Provider'),
        type: 'ai',
        orgId: ctx.orgId,
        brand: 'anthropic',
      })

      if (!aiProv.ok) return
      createdProviderIds.push(aiProv.data.id)

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/sandboxes`, {
        name: uniqueName('Sandbox Git Wrong Type'),
        orgId: ctx.orgId,
        projectIds: [projectId],
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        gitProviderInputs: [
          { projectId, providers: [{ id: aiProv.data.id }] },
        ],
      })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('gitProviderInputs with nonexistent provider returns 404', async () => {
      if (!projectId) return

      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/sandboxes`, {
        name: uniqueName('Sandbox Git NotFound'),
        orgId: ctx.orgId,
        projectIds: [projectId],
        config: { image: 'ghcr.io/threadedstack/tdsk-sandbox' },
        gitProviderInputs: [
          { projectId, providers: [{ id: '00000000-0000-0000-0000-000000000001' }] },
        ],
      })

      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })
  })
})
