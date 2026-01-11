import type { TNavCtx } from '@TAF/types'

import { describe, it, expect } from 'vitest'
import { getDynamicNav } from '@TAF/utils/nav/getDynamicNav'
import { OrgNavItems, RepoNavItems, GlobalNavItems, BottomNavItems } from './nav'

describe('getDynamicNav', () => {
  describe('with no context', () => {
    it('should return only global section', () => {
      const config = getDynamicNav({})
      expect(config.sections.length).toBe(1)
      expect(config.sections[0].id).toBe('global')
    })

    it('should return bottom nav items', () => {
      const config = getDynamicNav({})
      expect(config.bottomItems.length).toBeGreaterThan(0)
      expect(config.bottomItems).toBe(BottomNavItems)
    })

    it('should have global items in first section', () => {
      const config = getDynamicNav({})
      expect(config.sections[0].items).toBe(GlobalNavItems)
    })

    it('should not include org or repo sections', () => {
      const config = getDynamicNav({})
      const sectionIds = config.sections.map((s) => s.id)
      expect(sectionIds).not.toContain('org')
      expect(sectionIds).not.toContain('repo')
    })
  })

  describe('with org context', () => {
    const orgContext: TNavCtx = {
      orgId: 'org-123',
      org: { name: 'Engineering' } as any,
    }

    it('should return global and org sections', () => {
      const config = getDynamicNav(orgContext)
      expect(config.sections.length).toBe(2)
      expect(config.sections[0].id).toBe('global')
      expect(config.sections[1].id).toBe('org')
    })

    it('should have org name in header', () => {
      const config = getDynamicNav(orgContext)
      const orgSection = config.sections.find((s) => s.id === 'org')
      expect(orgSection?.header).toBe('Engineering')
    })

    it('should use default header when orgName is not provided', () => {
      const config = getDynamicNav({ orgId: 'org-123' })
      const orgSection = config.sections.find((s) => s.id === 'org')
      expect(orgSection?.header).toBe('Org')
    })

    it('should have org items in org section', () => {
      const config = getDynamicNav(orgContext)
      const orgSection = config.sections.find((s) => s.id === 'org')
      expect(orgSection?.items).toBe(OrgNavItems)
    })

    it('should have visible function for org section', () => {
      const config = getDynamicNav(orgContext)
      const orgSection = config.sections.find((s) => s.id === 'org')
      expect(orgSection?.visible).toBeDefined()
      expect(typeof orgSection?.visible).toBe('function')
    })

    it('should not include repo section when repoId is missing', () => {
      const config = getDynamicNav(orgContext)
      const sectionIds = config.sections.map((s) => s.id)
      expect(sectionIds).not.toContain('repo')
    })
  })

  describe('with org and repo context', () => {
    const fullContext: TNavCtx = {
      orgId: 'org-123',
      org: { name: 'Engineering' } as any,
      repoId: 'repo-456',
      repo: { name: 'API Gateway' } as any,
    }

    it('should return global, org, and repo sections', () => {
      const config = getDynamicNav(fullContext)
      expect(config.sections.length).toBe(3)
      expect(config.sections[0].id).toBe('global')
      expect(config.sections[1].id).toBe('org')
      expect(config.sections[2].id).toBe('repo')
    })

    it('should have repo name in repo section header', () => {
      const config = getDynamicNav(fullContext)
      const repoSection = config.sections.find((s) => s.id === 'repo')
      expect(repoSection?.header).toBe('API Gateway')
    })

    it('should use default header when repoName is not provided', () => {
      const config = getDynamicNav({
        orgId: 'org-123',
        repoId: 'repo-456',
      })
      const repoSection = config.sections.find((s) => s.id === 'repo')
      expect(repoSection?.header).toBe('Repository')
    })

    it('should have repo items in repo section', () => {
      const config = getDynamicNav(fullContext)
      const repoSection = config.sections.find((s) => s.id === 'repo')
      expect(repoSection?.items).toBe(RepoNavItems)
    })

    it('should have visible function for repo section', () => {
      const config = getDynamicNav(fullContext)
      const repoSection = config.sections.find((s) => s.id === 'repo')
      expect(repoSection?.visible).toBeDefined()
      expect(typeof repoSection?.visible).toBe('function')
    })

    it('should have correct section order', () => {
      const config = getDynamicNav(fullContext)
      const sectionIds = config.sections.map((s) => s.id)
      expect(sectionIds).toEqual(['global', 'org', 'repo'])
    })
  })

  describe('with partial context', () => {
    it('should not include repo section when orgId is missing', () => {
      const config = getDynamicNav({
        repoId: 'repo-456',
        repo: { name: 'API Gateway' } as any,
      })
      const sectionIds = config.sections.map((s) => s.id)
      expect(sectionIds).not.toContain('repo')
    })

    it('should handle empty orgName gracefully', () => {
      const config = getDynamicNav({
        orgId: 'org-123',
        org: { name: '' } as any,
      })
      const orgSection = config.sections.find((s) => s.id === 'org')
      expect(orgSection?.header).toBe('Org')
    })

    it('should handle empty repoName gracefully', () => {
      const config = getDynamicNav({
        orgId: 'org-123',
        repoId: 'repo-456',
        repo: { name: '' } as any,
      })
      const repoSection = config.sections.find((s) => s.id === 'repo')
      expect(repoSection?.header).toBe('Repository')
    })
  })
})

describe('OrgNavItems', () => {
  describe('path generation', () => {
    it('should generate correct path for Users with orgId', () => {
      const context: TNavCtx = { orgId: 'abc-123' }
      const usersItem = OrgNavItems.find((item) => item.text === 'Users')
      const path =
        typeof usersItem?.to === 'function' ? usersItem.to(context) : usersItem?.to
      expect(path).toBe('/orgs/abc-123/users')
    })

    it('should generate correct path for Repos with orgId', () => {
      const context: TNavCtx = { orgId: 'xyz-789' }
      const reposItem = OrgNavItems.find((item) => item.text === 'Repos')
      const path =
        typeof reposItem?.to === 'function' ? reposItem.to(context) : reposItem?.to
      expect(path).toBe('/orgs/xyz-789/repos')
    })

    it('should generate correct path for Secrets with orgId', () => {
      const context: TNavCtx = { orgId: 'org-456' }
      const secretsItem = OrgNavItems.find((item) => item.text === 'Secrets')
      const path =
        typeof secretsItem?.to === 'function' ? secretsItem.to(context) : secretsItem?.to
      expect(path).toBe('/orgs/org-456/secrets')
    })

    it('should generate correct path for Providers with orgId', () => {
      const context: TNavCtx = { orgId: 'org-789' }
      const providersItem = OrgNavItems.find((item) => item.text === 'Providers')
      const path =
        typeof providersItem?.to === 'function'
          ? providersItem.to(context)
          : providersItem?.to
      expect(path).toBe('/orgs/org-789/providers')
    })

    it('should generate correct path for Org Settings with orgId', () => {
      const context: TNavCtx = { orgId: 'org-settings-1' }
      const settingsItem = OrgNavItems.find((item) => item.text === 'Org Settings')
      const path =
        typeof settingsItem?.to === 'function'
          ? settingsItem.to(context)
          : settingsItem?.to
      expect(path).toBe('/orgs/org-settings-1/settings')
    })
  })

  describe('fallback behavior', () => {
    it('should return # when orgId is missing', () => {
      const context: TNavCtx = {}
      const usersItem = OrgNavItems.find((item) => item.text === 'Users')
      const path =
        typeof usersItem?.to === 'function' ? usersItem.to(context) : usersItem?.to
      expect(path).toBe('#')
    })

    it('should return # for all items when orgId is missing', () => {
      const context: TNavCtx = {}
      OrgNavItems.forEach((item) => {
        const path = typeof item.to === 'function' ? item.to(context) : item.to
        expect(path).toBe('#')
      })
    })
  })

  describe('visibility', () => {
    it('should be visible when orgId is present', () => {
      const context: TNavCtx = { orgId: 'org-123' }
      OrgNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(true)
      })
    })

    it('should not be visible when orgId is missing', () => {
      const context: TNavCtx = {}
      OrgNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })
  })

  describe('structure', () => {
    it('should have all required items', () => {
      const expectedItems = ['Users', 'Repos', 'Secrets', 'Providers', 'Org Settings']
      const actualItems = OrgNavItems.map((item) => item.text)
      expect(actualItems).toEqual(expectedItems)
    })

    it('should have Icons for all items', () => {
      OrgNavItems.forEach((item) => {
        expect(item.Icon).toBeDefined()
      })
    })
  })
})

describe('RepoNavItems', () => {
  describe('path generation', () => {
    it('should generate correct path for Endpoints with orgId and repoId', () => {
      const context: TNavCtx = { orgId: 'org-1', repoId: 'repo-2' }
      const endpointsItem = RepoNavItems.find((item) => item.text === 'Endpoints')
      const path =
        typeof endpointsItem?.to === 'function'
          ? endpointsItem.to(context)
          : endpointsItem?.to
      expect(path).toBe('/orgs/org-1/repos/repo-2/endpoints')
    })

    it('should generate correct path for Functions with orgId and repoId', () => {
      const context: TNavCtx = { orgId: 'org-abc', repoId: 'repo-xyz' }
      const functionsItem = RepoNavItems.find((item) => item.text === 'Functions')
      const path =
        typeof functionsItem?.to === 'function'
          ? functionsItem.to(context)
          : functionsItem?.to
      expect(path).toBe('/orgs/org-abc/repos/repo-xyz/functions')
    })

    it('should generate correct path for Secrets with orgId and repoId', () => {
      const context: TNavCtx = { orgId: 'org-123', repoId: 'repo-456' }
      const secretsItem = RepoNavItems.find((item) => item.text === 'Secrets')
      const path =
        typeof secretsItem?.to === 'function' ? secretsItem.to(context) : secretsItem?.to
      expect(path).toBe('/orgs/org-123/repos/repo-456/secrets')
    })

    it('should generate correct path for Providers with orgId and repoId', () => {
      const context: TNavCtx = { orgId: 'org-789', repoId: 'repo-101' }
      const providersItem = RepoNavItems.find((item) => item.text === 'Providers')
      const path =
        typeof providersItem?.to === 'function'
          ? providersItem.to(context)
          : providersItem?.to
      expect(path).toBe('/orgs/org-789/repos/repo-101/providers')
    })

    it('should generate correct path for Repo Settings with orgId and repoId', () => {
      const context: TNavCtx = { orgId: 'org-settings', repoId: 'repo-settings' }
      const settingsItem = RepoNavItems.find((item) => item.text === 'Repo Settings')
      const path =
        typeof settingsItem?.to === 'function'
          ? settingsItem.to(context)
          : settingsItem?.to
      expect(path).toBe('/orgs/org-settings/repos/repo-settings/settings')
    })
  })

  describe('fallback behavior', () => {
    it('should return # when repoId is missing', () => {
      const context: TNavCtx = { orgId: 'org-1' }
      const endpointsItem = RepoNavItems.find((item) => item.text === 'Endpoints')
      const path =
        typeof endpointsItem?.to === 'function'
          ? endpointsItem.to(context)
          : endpointsItem?.to
      expect(path).toBe('#')
    })

    it('should return # when orgId is missing', () => {
      const context: TNavCtx = { repoId: 'repo-1' }
      const endpointsItem = RepoNavItems.find((item) => item.text === 'Endpoints')
      const path =
        typeof endpointsItem?.to === 'function'
          ? endpointsItem.to(context)
          : endpointsItem?.to
      expect(path).toBe('#')
    })

    it('should return # when both orgId and repoId are missing', () => {
      const context: TNavCtx = {}
      const endpointsItem = RepoNavItems.find((item) => item.text === 'Endpoints')
      const path =
        typeof endpointsItem?.to === 'function'
          ? endpointsItem.to(context)
          : endpointsItem?.to
      expect(path).toBe('#')
    })

    it('should return # for all items when context is incomplete', () => {
      const context: TNavCtx = { orgId: 'org-1' }
      RepoNavItems.forEach((item) => {
        const path = typeof item.to === 'function' ? item.to(context) : item.to
        expect(path).toBe('#')
      })
    })
  })

  describe('visibility', () => {
    it('should be visible when orgId and repoId are present', () => {
      const context: TNavCtx = { orgId: 'org-123', repoId: 'repo-456' }
      RepoNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(true)
      })
    })

    it('should not be visible when orgId is missing', () => {
      const context: TNavCtx = { repoId: 'repo-456' }
      RepoNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })

    it('should not be visible when repoId is missing', () => {
      const context: TNavCtx = { orgId: 'org-123' }
      RepoNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })

    it('should not be visible when both orgId and repoId are missing', () => {
      const context: TNavCtx = {}
      RepoNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })
  })

  describe('structure', () => {
    it('should have all required items', () => {
      const expectedItems = [
        'Endpoints',
        'Functions',
        'Secrets',
        'Providers',
        'Repo Settings',
      ]
      const actualItems = RepoNavItems.map((item) => item.text)
      expect(actualItems).toEqual(expectedItems)
    })

    it('should have Icons for all items', () => {
      RepoNavItems.forEach((item) => {
        expect(item.Icon).toBeDefined()
      })
    })
  })
})

describe('GlobalNavItems', () => {
  it('should have Home and AI items', () => {
    expect(GlobalNavItems.length).toBe(2)
    const texts = GlobalNavItems.map((item) => item.text)
    expect(texts).toContain('Home')
    expect(texts).toContain('AI')
  })

  it('should have static paths (not functions)', () => {
    GlobalNavItems.forEach((item) => {
      expect(typeof item.to).toBe('string')
    })
  })

  it('should have Icons for all items', () => {
    GlobalNavItems.forEach((item) => {
      expect(item.Icon).toBeDefined()
    })
  })
})

describe('BottomNavItems', () => {
  it('should have Settings item', () => {
    expect(BottomNavItems.length).toBeGreaterThan(0)
    const settingsItem = BottomNavItems.find((item) => item.text === 'Settings')
    expect(settingsItem).toBeDefined()
  })

  it('should have static paths (not functions)', () => {
    BottomNavItems.forEach((item) => {
      expect(typeof item.to).toBe('string')
    })
  })

  it('should have Icons for all items', () => {
    BottomNavItems.forEach((item) => {
      expect(item.Icon).toBeDefined()
    })
  })
})
