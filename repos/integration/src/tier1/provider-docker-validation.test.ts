import { describe, test, expect, afterAll } from 'vitest'
import { EDockerProviderBrand } from '@tdsk/domain'
import { post, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

const validDockerBrands = Object.values(EDockerProviderBrand) as string[]

describe(`Tier 1: Provider Docker Validation`, () => {
  const ctx = readContext()
  const createdIds: string[] = []

  afterAll(async () => {
    for (const id of createdIds) {
      await tryDelete(`/orgs/${ctx.orgId}/providers/${id}`)
    }
  })

  // ─── Create: Valid Docker Providers ──────────────────────────────

  describe(`create docker provider with valid brand`, () => {
    test(`POST /providers with type=docker brand=ghcr returns 201`, async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`Docker GHCR`),
          type: `docker`,
          brand: `ghcr`,
          options: { registry: `ghcr.io`, username: `testuser` },
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data.type).toBe(`docker`)
      expect(res.data.brand).toBe(`ghcr`)
      expect(res.data.options?.registry).toBe(`ghcr.io`)
      expect(res.data.options?.username).toBe(`testuser`)

      createdIds.push(res.data.id)
    })

    test(`POST /providers with type=docker brand=dockerhub returns 201`, async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`Docker Hub`),
          type: `docker`,
          brand: `dockerhub`,
          options: { registry: `https://index.docker.io/v1/`, username: `testuser` },
        }
      )

      expect(res.status).toBe(201)
      expect(res.data.brand).toBe(`dockerhub`)

      createdIds.push(res.data.id)
    })

    test(`POST /providers with type=docker brand=gitlab returns 201`, async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`Docker GitLab`),
          type: `docker`,
          brand: `gitlab`,
          options: { registry: `registry.gitlab.com`, username: `deploy-token` },
        }
      )

      expect(res.status).toBe(201)
      expect(res.data.brand).toBe(`gitlab`)

      createdIds.push(res.data.id)
    })

    test(`POST /providers with type=docker brand=quay returns 201`, async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`Docker Quay`),
          type: `docker`,
          brand: `quay`,
          options: { registry: `quay.io`, username: `testuser` },
        }
      )

      expect(res.status).toBe(201)
      expect(res.data.brand).toBe(`quay`)

      createdIds.push(res.data.id)
    })

    test(`POST /providers with type=docker brand=custom returns 201`, async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`Docker Custom`),
          type: `docker`,
          brand: `custom`,
          options: { registry: `registry.example.com`, username: `deploy` },
        }
      )

      expect(res.status).toBe(201)
      expect(res.data.brand).toBe(`custom`)

      createdIds.push(res.data.id)
    })
  })

  // ─── Create: Invalid Docker Providers ───────────────────────────

  describe(`create docker provider without valid brand`, () => {
    test(`POST /providers type=docker without brand returns 400`, async () => {
      const res = await post<{ error?: string }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`Docker No Brand`),
          type: `docker`,
        }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test(`POST /providers type=docker with invalid brand returns 400`, async () => {
      const res = await post<{ error?: string }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`Docker Invalid Brand`),
          type: `docker`,
          brand: `not-a-registry`,
        }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test(`POST /providers type=docker with AI brand returns 400`, async () => {
      const res = await post<{ error?: string }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`Docker Wrong Brand`),
          type: `docker`,
          brand: `anthropic`,
        }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })
  })

  // ─── Update: Docker Provider Brand ──────────────────────────────

  describe(`update docker provider brand`, () => {
    let dockerProviderId = ``

    test(`setup: create docker provider for update tests`, async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`Docker Update Test`),
          type: `docker`,
          brand: `ghcr`,
          options: { registry: `ghcr.io`, username: `testuser` },
        }
      )

      expect(res.status).toBe(201)
      dockerProviderId = res.data.id
      createdIds.push(dockerProviderId)
    })

    test(`PUT /providers/:id can update name without affecting brand`, async () => {
      if (!dockerProviderId) return

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers/${dockerProviderId}`,
        { name: uniqueName(`Docker Updated Name`) }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    })

    test(`PUT /providers/:id with type=docker and invalid brand rejects`, async () => {
      if (!dockerProviderId) return

      const res = await put<{ error?: string }>(
        `/orgs/${ctx.orgId}/providers/${dockerProviderId}`,
        { type: `docker`, brand: `invalid` }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test(`PUT /providers/:id with type=docker and valid brand accepts`, async () => {
      if (!dockerProviderId) return

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers/${dockerProviderId}`,
        {
          type: `docker`,
          brand: `dockerhub`,
          options: { registry: `https://index.docker.io/v1/`, username: `updated-user` },
        }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    })
  })

  // ─── Read: Docker Providers ─────────────────────────────────────

  describe(`existing docker providers have valid brand`, () => {
    test(`GET /providers includes docker providers with valid brands`, async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName(`Docker Read Test`),
          type: `docker`,
          brand: `ghcr`,
          options: { registry: `ghcr.io`, username: `reader` },
        }
      )

      expect(res.status).toBe(201)
      createdIds.push(res.data.id)

      const listRes = await (await import(`../utils/api-client`)).get<Record<string, any>[]>(
        `/orgs/${ctx.orgId}/providers?limit=500`
      )

      expect(listRes.status).toBe(200)
      expect(Array.isArray(listRes.data)).toBe(true)

      const dockerProviders = listRes.data.filter((p: any) => p.type === `docker`)
      expect(dockerProviders.length).toBeGreaterThan(0)

      for (const provider of dockerProviders) {
        expect(provider.brand).toBeDefined()
        expect(validDockerBrands).toContain(provider.brand)
      }
    })
  })
})
