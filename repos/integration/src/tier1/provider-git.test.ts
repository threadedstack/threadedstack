import { describe, test, expect, afterAll } from 'vitest'
import { EGitProvider } from '@tdsk/domain'
import { post, put, get, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

const validBrands = Object.values(EGitProvider) as string[]

describe('Tier 1: Git Provider CRUD', () => {
  const ctx = readContext()
  const createdIds: string[] = []

  afterAll(async () => {
    for (const id of createdIds) {
      await tryDelete(`/orgs/${ctx.orgId}/providers/${id}`)
    }
  })

  describe('create git provider with valid brand', () => {
    test('POST /providers with brand=github returns 201', async () => {
      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('Git GitHub'),
        type: 'git',
        orgId: ctx.orgId,
        brand: 'github',
        options: { repoUrl: 'https://github.com/example/repo.git', branch: 'main' },
      })

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data.type).toBe('git')
      expect(res.data.brand).toBe('github')
      expect(res.data.options.repoUrl).toBe('https://github.com/example/repo.git')
      expect(res.data.options.branch).toBe('main')

      createdIds.push(res.data.id)
    })

    test('POST /providers with brand=gitlab returns 201', async () => {
      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('Git GitLab'),
        type: 'git',
        orgId: ctx.orgId,
        brand: 'gitlab',
        options: { repoUrl: 'https://gitlab.com/example/repo.git' },
      })

      expect(res.status).toBe(201)
      expect(res.data.brand).toBe('gitlab')
      createdIds.push(res.data.id)
    })

    test('POST /providers with brand=bitbucket returns 201', async () => {
      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('Git Bitbucket'),
        type: 'git',
        orgId: ctx.orgId,
        brand: 'bitbucket',
      })

      expect(res.status).toBe(201)
      expect(res.data.brand).toBe('bitbucket')
      createdIds.push(res.data.id)
    })
  })

  describe('create git provider without valid brand', () => {
    test('POST /providers type=git without brand returns 400', async () => {
      const res = await post<{ error?: string }>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('Should Fail No Brand'),
        type: 'git',
        orgId: ctx.orgId,
      })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('POST /providers type=git with invalid brand returns 400', async () => {
      const res = await post<{ error?: string }>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('Should Fail Invalid'),
        type: 'git',
        orgId: ctx.orgId,
        brand: 'svn',
      })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })
  })

  describe('GET/PUT/DELETE git provider', () => {
    let gitProviderId = ''

    test('setup: create git provider', async () => {
      const res = await post<Record<string, any>>(`/orgs/${ctx.orgId}/providers`, {
        name: uniqueName('Git CRUD Test'),
        type: 'git',
        orgId: ctx.orgId,
        brand: 'github',
        options: { repoUrl: 'https://github.com/test/crud.git', branch: 'develop' },
      })
      expect(res.status).toBe(201)
      gitProviderId = res.data.id
      createdIds.push(gitProviderId)
    })

    test('GET /providers/:id returns git provider', async () => {
      if (!gitProviderId) return
      const res = await get<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers/${gitProviderId}`
      )
      expect(res.status).toBe(200)
      expect(res.data.type).toBe('git')
      expect(res.data.brand).toBe('github')
      expect(res.data.options.repoUrl).toBe('https://github.com/test/crud.git')
      expect(res.data.options.branch).toBe('develop')
    })

    test('PUT /providers/:id updates git provider options', async () => {
      if (!gitProviderId) return
      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers/${gitProviderId}`,
        { options: { repoUrl: 'https://github.com/test/updated.git', branch: 'main' } }
      )
      expect(res.status).toBe(200)
      expect(res.data.options.repoUrl).toBe('https://github.com/test/updated.git')
      expect(res.data.options.branch).toBe('main')
    })

    test('PUT /providers/:id rejects invalid brand change', async () => {
      if (!gitProviderId) return
      const res = await put<{ error?: string }>(
        `/orgs/${ctx.orgId}/providers/${gitProviderId}`,
        { type: 'git', brand: 'invalid' }
      )
      expect(res.status).toBe(400)
    })
  })

  describe('existing git providers in listing', () => {
    test('GET /providers returns git providers with brand set', async () => {
      const res = await get<Record<string, any>[]>(`/orgs/${ctx.orgId}/providers`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)

      const gitProviders = res.data.filter((p: any) => p.type === 'git')

      for (const provider of gitProviders) {
        expect(provider.brand).toBeDefined()
        expect(validBrands).toContain(provider.brand)
      }
    })
  })
})
