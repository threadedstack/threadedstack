import type { TNavCtx } from '@TAF/types'

import { describe, it, expect } from 'vitest'
import { getDynamicNav } from '@TAF/utils/nav/getDynamicNav'
import {
  OrgNavItems,
  ProjectNavItems,
  BottomNavItems,
  OrgSubNavGroups,
  ProjectSubNavGroups,
  HomeSubNavGroups,
  RailNavSections,
  GlobalNavItems,
} from './nav'

describe(`getDynamicNav`, () => {
  describe(`with no context`, () => {
    it(`should return global nav section`, () => {
      const config = getDynamicNav({})
      expect(config.sections.length).toBe(1)
      expect(config.sections[0].id).toBe(`global`)
    })

    it(`should return bottom nav items`, () => {
      const config = getDynamicNav({})
      expect(config.bottomItems.length).toBeGreaterThan(0)
      expect(config.bottomItems).toBe(BottomNavItems)
    })

    it(`should not include org or project sections`, () => {
      const config = getDynamicNav({})
      const sectionIds = config.sections.map((s) => s.id)
      expect(sectionIds).not.toContain(`org`)
      expect(sectionIds).not.toContain(`project`)
    })
  })

  describe(`with org context`, () => {
    const orgContext: TNavCtx = {
      orgId: `org-123`,
      org: { name: `Engineering` } as any,
    }

    it(`should return org and project sections`, () => {
      const config = getDynamicNav(orgContext)
      expect(config.sections.length).toBe(2)
      expect(config.sections[0].id).toBe(`org`)
      expect(config.sections[1].id).toBe(`project`)
    })

    it(`should have org name in header`, () => {
      const config = getDynamicNav(orgContext)
      const orgSection = config.sections.find((s) => s.id === `org`)
      expect(orgSection?.header).toBe(`Engineering`)
    })

    it(`should use default header when orgName is not provided`, () => {
      const config = getDynamicNav({ orgId: `org-123` })
      const orgSection = config.sections.find((s) => s.id === `org`)
      expect(orgSection?.header).toBe(`Organization`)
    })

    it(`should have org items in org section`, () => {
      const config = getDynamicNav(orgContext)
      const orgSection = config.sections.find((s) => s.id === `org`)
      expect(orgSection?.items).toBe(OrgNavItems)
    })

    it(`should have visible function for org section`, () => {
      const config = getDynamicNav(orgContext)
      const orgSection = config.sections.find((s) => s.id === `org`)
      expect(orgSection?.visible).toBeDefined()
      expect(typeof orgSection?.visible).toBe(`function`)
    })

    it(`should include project section when orgId is present`, () => {
      const config = getDynamicNav(orgContext)
      const sectionIds = config.sections.map((s) => s.id)
      expect(sectionIds).toContain(`project`)
    })
  })

  describe(`with org and project context`, () => {
    const fullContext: TNavCtx = {
      orgId: `org-123`,
      org: { name: `Engineering` } as any,
      projectId: `project-456`,
      project: { name: `API Gateway` } as any,
    }

    it(`should return org and project sections`, () => {
      const config = getDynamicNav(fullContext)
      expect(config.sections.length).toBe(2)
      expect(config.sections[0].id).toBe(`org`)
      expect(config.sections[1].id).toBe(`project`)
    })

    it(`should have project name in project section header`, () => {
      const config = getDynamicNav(fullContext)
      const projectSection = config.sections.find((s) => s.id === `project`)
      expect(projectSection?.header).toBe(`API Gateway`)
    })

    it(`should use default header when projectName is not provided`, () => {
      const config = getDynamicNav({
        orgId: `org-123`,
        projectId: `project-456`,
      })
      const projectSection = config.sections.find((s) => s.id === `project`)
      expect(projectSection?.header).toBe(`Project`)
    })

    it(`should have project items in project section`, () => {
      const config = getDynamicNav(fullContext)
      const projectSection = config.sections.find((s) => s.id === `project`)
      // getDynamicNav uses buildProjectNavItems which filters Threads
      // and transforms Agents with sub-items, so it's not the same reference
      const itemTexts = projectSection?.items.map((i) => i.text)
      expect(itemTexts).toEqual([
        `Endpoints`,
        `Functions`,
        `Secrets`,
        `Agents`,
        `Members`,
        `Domains`,
        `API Keys`,
        `Settings`,
      ])
    })

    it(`should have visible function for project section`, () => {
      const config = getDynamicNav(fullContext)
      const projectSection = config.sections.find((s) => s.id === `project`)
      expect(projectSection?.visible).toBeDefined()
      expect(typeof projectSection?.visible).toBe(`function`)
    })

    it(`should have correct section order`, () => {
      const config = getDynamicNav(fullContext)
      const sectionIds = config.sections.map((s) => s.id)
      expect(sectionIds).toEqual([`org`, `project`])
    })
  })

  describe(`with partial context`, () => {
    it(`should not include project section when orgId is missing`, () => {
      const config = getDynamicNav({
        projectId: `project-456`,
        project: { name: `API Gateway` } as any,
      })
      const sectionIds = config.sections.map((s) => s.id)
      expect(sectionIds).not.toContain(`project`)
    })

    it(`should handle empty orgName gracefully`, () => {
      const config = getDynamicNav({
        orgId: `org-123`,
        org: { name: `` } as any,
      })
      const orgSection = config.sections.find((s) => s.id === `org`)
      expect(orgSection?.header).toBe(`Organization`)
    })

    it(`should handle empty projectName gracefully`, () => {
      const config = getDynamicNav({
        orgId: `org-123`,
        projectId: `project-456`,
        project: { name: `` } as any,
      })
      const projectSection = config.sections.find((s) => s.id === `project`)
      expect(projectSection?.header).toBe(`Project`)
    })
  })
})

describe(`OrgNavItems`, () => {
  describe(`path generation`, () => {
    it(`should generate correct path for Members with orgId`, () => {
      const context: TNavCtx = { orgId: `abc-123` }
      const membersItem = OrgNavItems.find((item) => item.text === `Members`)
      const path =
        typeof membersItem?.to === `function` ? membersItem.to(context) : membersItem?.to
      expect(path).toBe(`/orgs/abc-123/members`)
    })

    it(`should generate correct path for Projects with orgId`, () => {
      const context: TNavCtx = { orgId: `xyz-789` }
      const projectsItem = OrgNavItems.find((item) => item.text === `Projects`)
      const path =
        typeof projectsItem?.to === `function`
          ? projectsItem.to(context)
          : projectsItem?.to
      expect(path).toBe(`/orgs/xyz-789/projects`)
    })

    it(`should generate correct path for Secrets with orgId`, () => {
      const context: TNavCtx = { orgId: `org-456` }
      const secretsItem = OrgNavItems.find((item) => item.text === `Secrets`)
      const path =
        typeof secretsItem?.to === `function` ? secretsItem.to(context) : secretsItem?.to
      expect(path).toBe(`/orgs/org-456/secrets`)
    })

    it(`should generate correct path for Providers with orgId`, () => {
      const context: TNavCtx = { orgId: `org-789` }
      const providersItem = OrgNavItems.find((item) => item.text === `Providers`)
      const path =
        typeof providersItem?.to === `function`
          ? providersItem.to(context)
          : providersItem?.to
      expect(path).toBe(`/orgs/org-789/providers`)
    })

    it(`should generate correct path for Org Settings with orgId`, () => {
      const context: TNavCtx = { orgId: `org-settings-1` }
      const settingsItem = OrgNavItems.find((item) => item.text === `Settings`)
      const path =
        typeof settingsItem?.to === `function`
          ? settingsItem.to(context)
          : settingsItem?.to
      expect(path).toBe(`/orgs/org-settings-1/settings`)
    })
  })

  describe(`fallback behavior`, () => {
    it(`should return # when orgId is missing`, () => {
      const context: TNavCtx = {}
      const membersItem = OrgNavItems.find((item) => item.text === `Members`)
      const path =
        typeof membersItem?.to === `function` ? membersItem.to(context) : membersItem?.to
      expect(path).toBe(`#`)
    })

    it(`should return # for all items when orgId is missing`, () => {
      const context: TNavCtx = {}
      OrgNavItems.forEach((item) => {
        const path = typeof item.to === `function` ? item.to(context) : item.to
        expect(path).toBe(`#`)
      })
    })
  })

  describe(`visibility`, () => {
    it(`should be visible when orgId is present`, () => {
      const context: TNavCtx = { orgId: `org-123` }
      OrgNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(true)
      })
    })

    it(`should not be visible when orgId is missing`, () => {
      const context: TNavCtx = {}
      OrgNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })
  })

  describe(`structure`, () => {
    it(`should have all required items`, () => {
      const expectedItems = [
        `Projects`,
        `Agents`,
        `Sandboxes`,
        `Members`,
        `Secrets`,
        `Providers`,
        `Domains`,
        `API Keys`,
        `Skills`,
        `Schedules`,
        `Usage`,
        `Settings`,
      ]
      const actualItems = OrgNavItems.map((item) => item.text)
      expect(actualItems).toEqual(expectedItems)
    })

    it(`should have Icons for all items`, () => {
      OrgNavItems.forEach((item) => {
        expect(item.Icon).toBeDefined()
      })
    })
  })
})

describe(`ProjectNavItems`, () => {
  describe(`path generation`, () => {
    it(`should generate correct path for Endpoints with orgId and projectId`, () => {
      const context: TNavCtx = { orgId: `org-1`, projectId: `project-2` }
      const endpointsItem = ProjectNavItems.find((item) => item.text === `Endpoints`)
      const path =
        typeof endpointsItem?.to === `function`
          ? endpointsItem.to(context)
          : endpointsItem?.to
      expect(path).toBe(`/orgs/org-1/projects/project-2/endpoints`)
    })

    it(`should generate correct path for Functions with orgId and projectId`, () => {
      const context: TNavCtx = { orgId: `org-abc`, projectId: `project-xyz` }
      const functionsItem = ProjectNavItems.find((item) => item.text === `Functions`)
      const path =
        typeof functionsItem?.to === `function`
          ? functionsItem.to(context)
          : functionsItem?.to
      expect(path).toBe(`/orgs/org-abc/projects/project-xyz/functions`)
    })

    it(`should generate correct path for Secrets with orgId and projectId`, () => {
      const context: TNavCtx = { orgId: `org-123`, projectId: `project-456` }
      const secretsItem = ProjectNavItems.find((item) => item.text === `Secrets`)
      const path =
        typeof secretsItem?.to === `function` ? secretsItem.to(context) : secretsItem?.to
      expect(path).toBe(`/orgs/org-123/projects/project-456/secrets`)
    })

    it(`should generate correct path for Project Settings with orgId and projectId`, () => {
      const context: TNavCtx = { orgId: `org-settings`, projectId: `project-settings` }
      const settingsItem = ProjectNavItems.find((item) => item.text === `Settings`)
      const path =
        typeof settingsItem?.to === `function`
          ? settingsItem.to(context)
          : settingsItem?.to
      expect(path).toBe(`/orgs/org-settings/projects/project-settings/settings`)
    })
  })

  describe(`fallback behavior`, () => {
    it(`should return # when projectId is missing`, () => {
      const context: TNavCtx = { orgId: `org-1` }
      const endpointsItem = ProjectNavItems.find((item) => item.text === `Endpoints`)
      const path =
        typeof endpointsItem?.to === `function`
          ? endpointsItem.to(context)
          : endpointsItem?.to
      expect(path).toBe(`#`)
    })

    it(`should return # when orgId is missing`, () => {
      const context: TNavCtx = { projectId: `project-1` }
      const endpointsItem = ProjectNavItems.find((item) => item.text === `Endpoints`)
      const path =
        typeof endpointsItem?.to === `function`
          ? endpointsItem.to(context)
          : endpointsItem?.to
      expect(path).toBe(`#`)
    })

    it(`should return # when both orgId and projectId are missing`, () => {
      const context: TNavCtx = {}
      const endpointsItem = ProjectNavItems.find((item) => item.text === `Endpoints`)
      const path =
        typeof endpointsItem?.to === `function`
          ? endpointsItem.to(context)
          : endpointsItem?.to
      expect(path).toBe(`#`)
    })

    it(`should return # for all items when context is incomplete`, () => {
      const context: TNavCtx = { orgId: `org-1` }
      ProjectNavItems.forEach((item) => {
        const path = typeof item.to === `function` ? item.to(context) : item.to
        expect(path).toBe(`#`)
      })
    })
  })

  describe(`visibility`, () => {
    it(`should be visible when orgId and projectId are present`, () => {
      const context: TNavCtx = { orgId: `org-123`, projectId: `project-456` }
      ProjectNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(true)
      })
    })

    it(`should not be visible when orgId is missing`, () => {
      const context: TNavCtx = { projectId: `project-456` }
      ProjectNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })

    it(`should not be visible when projectId is missing`, () => {
      const context: TNavCtx = { orgId: `org-123` }
      ProjectNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        // Domains only requires orgId, so it's visible even without projectId
        if (item.text === `Domains`) {
          expect(item.visible?.(context)).toBe(true)
        } else {
          expect(item.visible?.(context)).toBe(false)
        }
      })
    })

    it(`should not be visible when both orgId and projectId are missing`, () => {
      const context: TNavCtx = {}
      ProjectNavItems.forEach((item) => {
        expect(item.visible).toBeDefined()
        expect(item.visible?.(context)).toBe(false)
      })
    })
  })

  describe(`structure`, () => {
    it(`should have all required items`, () => {
      const expectedItems = [
        `Endpoints`,
        `Functions`,
        `Secrets`,
        `Agents`,
        `Members`,
        `Domains`,
        `API Keys`,
        `Settings`,
      ]
      const actualItems = ProjectNavItems.map((item) => item.text)
      expect(actualItems).toEqual(expectedItems)
    })

    it(`should have Icons for all items`, () => {
      ProjectNavItems.forEach((item) => {
        expect(item.Icon).toBeDefined()
      })
    })
  })
})

describe(`BottomNavItems`, () => {
  it(`should have Settings item`, () => {
    expect(BottomNavItems.length).toBeGreaterThan(0)
    const settingsItem = BottomNavItems.find((item) => item.text === `Settings`)
    expect(settingsItem).toBeDefined()
  })

  it(`should have static paths (not functions)`, () => {
    BottomNavItems.forEach((item) => {
      expect(typeof item.to).toBe(`string`)
    })
  })

  it(`should have Icons for all items`, () => {
    BottomNavItems.forEach((item) => {
      expect(item.Icon).toBeDefined()
    })
  })
})

// --- Sub-Nav Group Tests ---

describe(`OrgSubNavGroups`, () => {
  it(`should have 3 groups: Resources, Security, Management`, () => {
    expect(OrgSubNavGroups).toHaveLength(3)
    expect(OrgSubNavGroups.map((g) => g.label)).toEqual([
      `Resources`,
      `Security`,
      `Management`,
    ])
  })

  it(`Resources should have Projects, Providers, Agents, Sandboxes, Skills`, () => {
    const resources = OrgSubNavGroups.find((g) => g.label === `Resources`)
    const texts = resources?.items.map((i) => i.text)
    expect(texts).toEqual([`Projects`, `Providers`, `Agents`, `Sandboxes`, `Skills`])
  })

  it(`Security should have Secrets, Providers, API Keys, Domains`, () => {
    const security = OrgSubNavGroups.find((g) => g.label === `Security`)
    const texts = security?.items.map((i) => i.text)
    expect(texts).toEqual([`Secrets`, `API Keys`, `Domains`])
  })

  it(`Management should have Members, Schedules, Usage, Settings`, () => {
    const management = OrgSubNavGroups.find((g) => g.label === `Management`)
    const texts = management?.items.map((i) => i.text)
    expect(texts).toEqual([`Members`, `Schedules`, `Usage`, `Settings`])
  })

  it(`all items should have Icons`, () => {
    OrgSubNavGroups.forEach((group) => {
      group.items.forEach((item) => {
        expect(item.Icon).toBeDefined()
      })
    })
  })
})

describe(`ProjectSubNavGroups`, () => {
  it(`should have 3 groups: Development, Security, Management`, () => {
    expect(ProjectSubNavGroups).toHaveLength(3)
    expect(ProjectSubNavGroups.map((g) => g.label)).toEqual([
      `Development`,
      `Security`,
      `Management`,
    ])
  })

  it(`Development should have Endpoints, Functions, Agents`, () => {
    const dev = ProjectSubNavGroups.find((g) => g.label === `Development`)
    const texts = dev?.items.map((i) => i.text)
    expect(texts).toEqual([`Endpoints`, `Functions`, `Agents`])
  })

  it(`Security should have Secrets, API Keys, Domains`, () => {
    const security = ProjectSubNavGroups.find((g) => g.label === `Security`)
    const texts = security?.items.map((i) => i.text)
    expect(texts).toEqual([`Secrets`, `API Keys`, `Domains`])
  })

  it(`Management should have Members, Settings`, () => {
    const management = ProjectSubNavGroups.find((g) => g.label === `Management`)
    const texts = management?.items.map((i) => i.text)
    expect(texts).toEqual([`Members`, `Settings`])
  })

  it(`all items should have Icons`, () => {
    ProjectSubNavGroups.forEach((group) => {
      group.items.forEach((item) => {
        expect(item.Icon).toBeDefined()
      })
    })
  })
})

describe(`HomeSubNavGroups`, () => {
  it(`should have 1 group: Navigation`, () => {
    expect(HomeSubNavGroups).toHaveLength(1)
    expect(HomeSubNavGroups[0].label).toBe(`Navigation`)
  })

  it(`Navigation should have Billing and Profile`, () => {
    const texts = HomeSubNavGroups[0].items.map((i) => i.text)
    expect(texts).toEqual([`Billing`, `Profile`])
  })
})

describe(`RailNavSections`, () => {
  it(`should have Home, Org, and Project keys`, () => {
    expect(RailNavSections).toHaveProperty(`Home`)
    expect(RailNavSections).toHaveProperty(`Org`)
    expect(RailNavSections).toHaveProperty(`Project`)
  })

  it(`Home section should have id "home" and HomeSubNavGroups`, () => {
    expect(RailNavSections.Home.id).toBe(`home`)
    expect(RailNavSections.Home.label).toBe(`Home`)
    expect(RailNavSections.Home.groups).toBe(HomeSubNavGroups)
    expect(RailNavSections.Home.Icon).toBeDefined()
  })

  it(`Org section should have id "org" with visibility check`, () => {
    expect(RailNavSections.Org.id).toBe(`org`)
    expect(RailNavSections.Org.visible).toBeDefined()
    expect(RailNavSections.Org.visible?.({ orgId: `org-1` })).toBe(true)
    expect(RailNavSections.Org.visible?.({})).toBe(false)
    expect(RailNavSections.Org.groups).toBe(OrgSubNavGroups)
    expect(RailNavSections.Org.Icon).toBeDefined()
  })

  it(`Project section should have id "project" with visibility check`, () => {
    expect(RailNavSections.Project.id).toBe(`project`)
    expect(RailNavSections.Project.visible).toBeDefined()
    expect(
      RailNavSections.Project.visible?.({ orgId: `org-1`, projectId: `proj-1` })
    ).toBe(true)
    expect(RailNavSections.Project.visible?.({ orgId: `org-1` })).toBe(false)
    expect(RailNavSections.Project.visible?.({})).toBe(false)
    expect(RailNavSections.Project.Icon).toBeDefined()
  })
})

describe(`GlobalNavItems`, () => {
  it(`should have Billing and Profile`, () => {
    const texts = GlobalNavItems.map((i) => i.text)
    expect(texts).toEqual([`Billing`, `Profile`])
  })

  it(`should have static paths`, () => {
    GlobalNavItems.forEach((item) => {
      expect(typeof item.to).toBe(`string`)
    })
  })

  it(`should have Icons`, () => {
    GlobalNavItems.forEach((item) => {
      expect(item.Icon).toBeDefined()
    })
  })
})
