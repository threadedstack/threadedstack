import { describe, it, expect } from 'vitest'
import { getDynamicNavConfig, TeamNavItems, RepoNavItems, GlobalNavItems, BottomNavItems } from './nav'
import type { TNavContext } from '@TAF/types'

describe('getDynamicNavConfig', () => {
  describe('with no context', () => {
    it('should return only global section', () => {
      const config = getDynamicNavConfig({})
      expect(config.sections.length).toBe(1)
      expect(config.sections[0].id).toBe('global')
    })

    it('should return bottom nav items', () => {
      const config = getDynamicNavConfig({})
      expect(config.bottomItems.length).toBeGreaterThan(0)
      expect(config.bottomItems).toBe(BottomNavItems)
    })

    it('should have global items in first section', () => {
      const config = getDynamicNavConfig({})
      expect(config.sections[0].items).toBe(GlobalNavItems)
    })

    it('should not include team or repo sections', () => {
      const config = getDynamicNavConfig({})
      const sectionIds = config.sections.map(s => s.id)
      expect(sectionIds).not.toContain('team')
      expect(sectionIds).not.toContain('repo')
    })
  })

  describe('with team context', () => {
    const teamContext: TNavContext = {
      teamId: 'team-123',
      teamName: 'Engineering',
    }

    it('should return global and team sections', () => {
      const config = getDynamicNavConfig(teamContext)
      expect(config.sections.length).toBe(2)
      expect(config.sections[0].id).toBe('global')
      expect(config.sections[1].id).toBe('team')
    })

    it('should have team name in header', () => {
      const config = getDynamicNavConfig(teamContext)
      const teamSection = config.sections.find(s => s.id === 'team')
      expect(teamSection?.header).toBe('Engineering')
    })

    it('should use default header when teamName is not provided', () => {
      const config = getDynamicNavConfig({ teamId: 'team-123' })
      const teamSection = config.sections.find(s => s.id === 'team')
      expect(teamSection?.header).toBe('Team')
    })

    it('should have team items in team section', () => {
      const config = getDynamicNavConfig(teamContext)
      const teamSection = config.sections.find(s => s.id === 'team')
      expect(teamSection?.items).toBe(TeamNavItems)
    })

    it('should have visible function for team section', () => {
      const config = getDynamicNavConfig(teamContext)
      const teamSection = config.sections.find(s => s.id === 'team')
      expect(teamSection?.visible).toBeDefined()
      expect(typeof teamSection?.visible).toBe('function')
    })

    it('should not include repo section when repoId is missing', () => {
      const config = getDynamicNavConfig(teamContext)
      const sectionIds = config.sections.map(s => s.id)
      expect(sectionIds).not.toContain('repo')
    })
  })

  describe('with team and repo context', () => {
    const fullContext: TNavContext = {
      teamId: 'team-123',
      teamName: 'Engineering',
      repoId: 'repo-456',
      repoName: 'API Gateway',
    }

    it('should return global, team, and repo sections', () => {
      const config = getDynamicNavConfig(fullContext)
      expect(config.sections.length).toBe(3)
      expect(config.sections[0].id).toBe('global')
      expect(config.sections[1].id).toBe('team')
      expect(config.sections[2].id).toBe('repo')
    })

    it('should have repo name in repo section header', () => {
      const config = getDynamicNavConfig(fullContext)
      const repoSection = config.sections.find(s => s.id === 'repo')
      expect(repoSection?.header).toBe('API Gateway')
    })

    it('should use default header when repoName is not provided', () => {
      const config = getDynamicNavConfig({
        teamId: 'team-123',
        repoId: 'repo-456',
      })
      const repoSection = config.sections.find(s => s.id === 'repo')
      expect(repoSection?.header).toBe('Repository')
    })

    it('should have repo items in repo section', () => {
      const config = getDynamicNavConfig(fullContext)
      const repoSection = config.sections.find(s => s.id === 'repo')
      expect(repoSection?.items).toBe(RepoNavItems)
    })

    it('should have visible function for repo section', () => {
      const config = getDynamicNavConfig(fullContext)
      const repoSection = config.sections.find(s => s.id === 'repo')
      expect(repoSection?.visible).toBeDefined()
      expect(typeof repoSection?.visible).toBe('function')
    })

    it('should have correct section order', () => {
      const config = getDynamicNavConfig(fullContext)
      const sectionIds = config.sections.map(s => s.id)
      expect(sectionIds).toEqual(['global', 'team', 'repo'])
    })
  })

  describe('with partial context', () => {
    it('should not include repo section when teamId is missing', () => {
      const config = getDynamicNavConfig({
        repoId: 'repo-456',
        repoName: 'API Gateway',
      })
      const sectionIds = config.sections.map(s => s.id)
      expect(sectionIds).not.toContain('repo')
    })

    it('should handle empty teamName gracefully', () => {
      const config = getDynamicNavConfig({
        teamId: 'team-123',
        teamName: '',
      })
      const teamSection = config.sections.find(s => s.id === 'team')
      expect(teamSection?.header).toBe('Team')
    })

    it('should handle empty repoName gracefully', () => {
      const config = getDynamicNavConfig({
        teamId: 'team-123',
        repoId: 'repo-456',
        repoName: '',
      })
      const repoSection = config.sections.find(s => s.id === 'repo')
      expect(repoSection?.header).toBe('Repository')
    })
  })
})

describe('TeamNavItems', () => {
  describe('path generation', () => {
    it('should generate correct path for Users with teamId', () => {
      const context: TNavContext = { teamId: 'abc-123' }
      const usersItem = TeamNavItems.find(item => item.text === 'Users')
      const path = typeof usersItem?.to === 'function'
        ? usersItem.to(context)
        : usersItem?.to
      expect(path).toBe('/teams/abc-123/users')
    })

    it('should generate correct path for Repos with teamId', () => {
      const context: TNavContext = { teamId: 'xyz-789' }
      const reposItem = TeamNavItems.find(item => item.text === 'Repos')
      const path = typeof reposItem?.to === 'function'
        ? reposItem.to(context)
        : reposItem?.to
      expect(path).toBe('/teams/xyz-789/repos')
    })

    it('should generate correct path for Secrets with teamId', () => {
      const context: TNavContext = { teamId: 'team-456' }
      const secretsItem = TeamNavItems.find(item => item.text === 'Secrets')
      const path = typeof secretsItem?.to === 'function'
        ? secretsItem.to(context)
        : secretsItem?.to
      expect(path).toBe('/teams/team-456/secrets')
    })

    it('should generate correct path for Providers with teamId', () => {
      const context: TNavContext = { teamId: 'team-789' }
      const providersItem = TeamNavItems.find(item => item.text === 'Providers')
      const path = typeof providersItem?.to === 'function'
        ? providersItem.to(context)
        : providersItem?.to
      expect(path).toBe('/teams/team-789/providers')
    })

    it('should generate correct path for Team Settings with teamId', () => {
      const context: TNavContext = { teamId: 'team-settings-1' }
      const settingsItem = TeamNavItems.find(item => item.text === 'Team Settings')
      const path = typeof settingsItem?.to === 'function'
        ? settingsItem.to(context)
        : settingsItem?.to
      expect(path).toBe('/teams/team-settings-1/settings')
    })
  })

  describe('fallback behavior', () => {
    it('should return # when teamId is missing', () => {
      const context: TNavContext = {}
      const usersItem = TeamNavItems.find(item => item.text === 'Users')
      const path = typeof usersItem?.to === 'function'
        ? usersItem.to(context)
        : usersItem?.to
      expect(path).toBe('#')
    })

    it('should return # for all items when teamId is missing', () => {
      const context: TNavContext = {}
      TeamNavItems.forEach(item => {
        const path = typeof item.to === 'function'
          ? item.to(context)
          : item.to
        expect(path).toBe('#')
      })
    })
  })

  describe('visibility', () => {
    it('should be visible when teamId is present', () => {
      const context: TNavContext = { teamId: 'team-123' }
      TeamNavItems.forEach(item => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(true)
      })
    })

    it('should not be visible when teamId is missing', () => {
      const context: TNavContext = {}
      TeamNavItems.forEach(item => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })
  })

  describe('structure', () => {
    it('should have all required items', () => {
      const expectedItems = ['Users', 'Repos', 'Secrets', 'Providers', 'Team Settings']
      const actualItems = TeamNavItems.map(item => item.text)
      expect(actualItems).toEqual(expectedItems)
    })

    it('should have Icons for all items', () => {
      TeamNavItems.forEach(item => {
        expect(item.Icon).toBeDefined()
      })
    })
  })
})

describe('RepoNavItems', () => {
  describe('path generation', () => {
    it('should generate correct path for Endpoints with teamId and repoId', () => {
      const context: TNavContext = { teamId: 'team-1', repoId: 'repo-2' }
      const endpointsItem = RepoNavItems.find(item => item.text === 'Endpoints')
      const path = typeof endpointsItem?.to === 'function'
        ? endpointsItem.to(context)
        : endpointsItem?.to
      expect(path).toBe('/teams/team-1/repos/repo-2/endpoints')
    })

    it('should generate correct path for Functions with teamId and repoId', () => {
      const context: TNavContext = { teamId: 'team-abc', repoId: 'repo-xyz' }
      const functionsItem = RepoNavItems.find(item => item.text === 'Functions')
      const path = typeof functionsItem?.to === 'function'
        ? functionsItem.to(context)
        : functionsItem?.to
      expect(path).toBe('/teams/team-abc/repos/repo-xyz/functions')
    })

    it('should generate correct path for Secrets with teamId and repoId', () => {
      const context: TNavContext = { teamId: 'team-123', repoId: 'repo-456' }
      const secretsItem = RepoNavItems.find(item => item.text === 'Secrets')
      const path = typeof secretsItem?.to === 'function'
        ? secretsItem.to(context)
        : secretsItem?.to
      expect(path).toBe('/teams/team-123/repos/repo-456/secrets')
    })

    it('should generate correct path for Providers with teamId and repoId', () => {
      const context: TNavContext = { teamId: 'team-789', repoId: 'repo-101' }
      const providersItem = RepoNavItems.find(item => item.text === 'Providers')
      const path = typeof providersItem?.to === 'function'
        ? providersItem.to(context)
        : providersItem?.to
      expect(path).toBe('/teams/team-789/repos/repo-101/providers')
    })

    it('should generate correct path for Repo Settings with teamId and repoId', () => {
      const context: TNavContext = { teamId: 'team-settings', repoId: 'repo-settings' }
      const settingsItem = RepoNavItems.find(item => item.text === 'Repo Settings')
      const path = typeof settingsItem?.to === 'function'
        ? settingsItem.to(context)
        : settingsItem?.to
      expect(path).toBe('/teams/team-settings/repos/repo-settings/settings')
    })
  })

  describe('fallback behavior', () => {
    it('should return # when repoId is missing', () => {
      const context: TNavContext = { teamId: 'team-1' }
      const endpointsItem = RepoNavItems.find(item => item.text === 'Endpoints')
      const path = typeof endpointsItem?.to === 'function'
        ? endpointsItem.to(context)
        : endpointsItem?.to
      expect(path).toBe('#')
    })

    it('should return # when teamId is missing', () => {
      const context: TNavContext = { repoId: 'repo-1' }
      const endpointsItem = RepoNavItems.find(item => item.text === 'Endpoints')
      const path = typeof endpointsItem?.to === 'function'
        ? endpointsItem.to(context)
        : endpointsItem?.to
      expect(path).toBe('#')
    })

    it('should return # when both teamId and repoId are missing', () => {
      const context: TNavContext = {}
      const endpointsItem = RepoNavItems.find(item => item.text === 'Endpoints')
      const path = typeof endpointsItem?.to === 'function'
        ? endpointsItem.to(context)
        : endpointsItem?.to
      expect(path).toBe('#')
    })

    it('should return # for all items when context is incomplete', () => {
      const context: TNavContext = { teamId: 'team-1' }
      RepoNavItems.forEach(item => {
        const path = typeof item.to === 'function'
          ? item.to(context)
          : item.to
        expect(path).toBe('#')
      })
    })
  })

  describe('visibility', () => {
    it('should be visible when teamId and repoId are present', () => {
      const context: TNavContext = { teamId: 'team-123', repoId: 'repo-456' }
      RepoNavItems.forEach(item => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(true)
      })
    })

    it('should not be visible when teamId is missing', () => {
      const context: TNavContext = { repoId: 'repo-456' }
      RepoNavItems.forEach(item => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })

    it('should not be visible when repoId is missing', () => {
      const context: TNavContext = { teamId: 'team-123' }
      RepoNavItems.forEach(item => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })

    it('should not be visible when both teamId and repoId are missing', () => {
      const context: TNavContext = {}
      RepoNavItems.forEach(item => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })
  })

  describe('structure', () => {
    it('should have all required items', () => {
      const expectedItems = ['Endpoints', 'Functions', 'Secrets', 'Providers', 'Repo Settings']
      const actualItems = RepoNavItems.map(item => item.text)
      expect(actualItems).toEqual(expectedItems)
    })

    it('should have Icons for all items', () => {
      RepoNavItems.forEach(item => {
        expect(item.Icon).toBeDefined()
      })
    })
  })
})

describe('GlobalNavItems', () => {
  it('should have Home and AI items', () => {
    expect(GlobalNavItems.length).toBe(2)
    const texts = GlobalNavItems.map(item => item.text)
    expect(texts).toContain('Home')
    expect(texts).toContain('AI')
  })

  it('should have static paths (not functions)', () => {
    GlobalNavItems.forEach(item => {
      expect(typeof item.to).toBe('string')
    })
  })

  it('should have Icons for all items', () => {
    GlobalNavItems.forEach(item => {
      expect(item.Icon).toBeDefined()
    })
  })
})

describe('BottomNavItems', () => {
  it('should have Settings item', () => {
    expect(BottomNavItems.length).toBeGreaterThan(0)
    const settingsItem = BottomNavItems.find(item => item.text === 'Settings')
    expect(settingsItem).toBeDefined()
  })

  it('should have static paths (not functions)', () => {
    BottomNavItems.forEach(item => {
      expect(typeof item.to).toBe('string')
    })
  })

  it('should have Icons for all items', () => {
    BottomNavItems.forEach(item => {
      expect(item.Icon).toBeDefined()
    })
  })
})
