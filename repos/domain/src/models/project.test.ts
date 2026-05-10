import { Project } from './project'
import { describe, it, expect } from 'vitest'
import { EProvider } from '@TDM/types/provider.types'

describe(`Project model`, () => {
  describe(`providers getter`, () => {
    it(`should return provider objects from providerLinks`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: { id: `p1`, type: EProvider.ai } as any,
            priority: 0,
            model: null,
          },
          {
            provider: { id: `p2`, type: EProvider.git } as any,
            priority: 1,
            model: null,
          },
        ],
      })

      expect(project.providers).toHaveLength(2)
      expect(project.providers[0].id).toBe(`p1`)
      expect(project.providers[1].id).toBe(`p2`)
    })

    it(`should return empty array when providerLinks is empty`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
        providerLinks: [],
      })

      expect(project.providers).toEqual([])
    })

    it(`should return empty array when providerLinks is not set`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
      })

      expect(project.providers).toEqual([])
    })
  })

  describe(`gitProviders getter`, () => {
    it(`should filter to only type='git' providers`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: { id: `p1`, type: EProvider.ai } as any,
            priority: 0,
            model: null,
          },
          {
            provider: {
              id: `p2`,
              type: EProvider.git,
              options: { repoUrl: `https://github.com/org/a` },
            } as any,
            priority: 1,
            model: null,
          },
          {
            provider: { id: `p3`, type: EProvider.docker } as any,
            priority: 2,
            model: null,
          },
          {
            provider: {
              id: `p4`,
              type: EProvider.git,
              options: { repoUrl: `https://github.com/org/b` },
            } as any,
            priority: 3,
            model: null,
          },
        ],
      })

      const gitProviders = project.gitProviders
      expect(gitProviders).toHaveLength(2)
      expect(gitProviders[0].id).toBe(`p2`)
      expect(gitProviders[1].id).toBe(`p4`)
    })

    it(`should return empty array when no git providers exist`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: { id: `p1`, type: EProvider.ai } as any,
            priority: 0,
            model: null,
          },
          {
            provider: { id: `p2`, type: EProvider.docker } as any,
            priority: 1,
            model: null,
          },
        ],
      })

      expect(project.gitProviders).toEqual([])
    })

    it(`should return empty array when providerLinks is empty`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
      })

      expect(project.gitProviders).toEqual([])
    })
  })

  describe(`primaryGitProvider getter`, () => {
    it(`should return the first git provider by link order`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: { id: `p1`, type: EProvider.ai } as any,
            priority: 0,
            model: null,
          },
          {
            provider: {
              id: `p2`,
              type: EProvider.git,
              options: { repoUrl: `https://github.com/org/first` },
            } as any,
            priority: 1,
            model: null,
          },
          {
            provider: {
              id: `p3`,
              type: EProvider.git,
              options: { repoUrl: `https://github.com/org/second` },
            } as any,
            priority: 2,
            model: null,
          },
        ],
      })

      const primary = project.primaryGitProvider
      expect(primary).toBeDefined()
      expect(primary!.id).toBe(`p2`)
    })

    it(`should return undefined when no git providers exist`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: { id: `p1`, type: EProvider.ai } as any,
            priority: 0,
            model: null,
          },
        ],
      })

      expect(project.primaryGitProvider).toBeUndefined()
    })

    it(`should return undefined when providerLinks is empty`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
      })

      expect(project.primaryGitProvider).toBeUndefined()
    })
  })

  describe(`gitUrl getter`, () => {
    it(`should return repoUrl from primary git provider`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: {
              id: `p1`,
              type: EProvider.git,
              options: { repoUrl: `https://github.com/org/repo` },
            } as any,
            priority: 0,
            model: null,
          },
        ],
      })
      expect(project.gitUrl).toBe(`https://github.com/org/repo`)
    })

    it(`should return undefined when no git provider exists`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
      })
      expect(project.gitUrl).toBeUndefined()
    })
  })

  describe(`branch getter`, () => {
    it(`should return branch from primary git provider`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: {
              id: `p1`,
              type: EProvider.git,
              options: { branch: `develop` },
            } as any,
            priority: 0,
            model: null,
          },
        ],
      })
      expect(project.branch).toBe(`develop`)
    })

    it(`should default to 'main' when no git provider exists`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
      })
      expect(project.branch).toBe(`main`)
    })

    it(`should default to 'main' when git provider has no branch option`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
        providerLinks: [
          {
            provider: {
              id: `p1`,
              type: EProvider.git,
              options: { repoUrl: `https://github.com/org/repo` },
            } as any,
            priority: 0,
            model: null,
          },
        ],
      })
      expect(project.branch).toBe(`main`)
    })
  })

  describe(`defaults`, () => {
    it(`should default providerLinks to empty array`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
      })
      expect(project.providerLinks).toEqual([])
    })

    it(`should default meta to empty object`, () => {
      const project = new Project({
        name: `Test Project`,
        orgId: `org-1`,
      })
      expect(project.meta).toEqual({})
    })

    it(`should accept constructor overrides`, () => {
      const project = new Project({
        name: `Override Project`,
        orgId: `org-1`,
        description: `A test project`,
        meta: { key: `value` },
      })
      expect(project.name).toBe(`Override Project`)
      expect(project.description).toBe(`A test project`)
      expect(project.meta).toEqual({ key: `value` })
    })
  })
})
