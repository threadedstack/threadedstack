import type { TNavCtx } from '@TAF/types'

import { describe, it, expect } from 'vitest'
import { getRailNavConfig } from './getRailNavConfig'

describe(`getRailNavConfig`, () => {
  describe(`with empty context`, () => {
    it(`should return no sections when orgId is missing`, () => {
      const config = getRailNavConfig({})
      expect(config.sections).toHaveLength(0)
    })

    it(`should have bottom items with Settings`, () => {
      const config = getRailNavConfig({})
      expect(config.bottomItems).toHaveLength(1)
      expect(config.bottomItems[0].text).toBe(`Settings`)
    })
  })

  describe(`with org context`, () => {
    const orgCtx: TNavCtx = {
      orgId: `org-123`,
      org: { name: `Engineering` } as any,
    }

    it(`should return Org and Project sections`, () => {
      const config = getRailNavConfig(orgCtx)
      expect(config.sections).toHaveLength(2)
      const ids = config.sections.map((s) => s.id)
      expect(ids).toEqual([`org`, `project`])
    })

    it(`should use org name as label and header for org section`, () => {
      const config = getRailNavConfig(orgCtx)
      const orgSection = config.sections.find((s) => s.id === `org`)
      expect(orgSection?.label).toBe(`Engineering`)
      expect(orgSection?.header).toBe(`Engineering`)
    })

    it(`should use default label when org name is missing`, () => {
      const config = getRailNavConfig({ orgId: `org-123` })
      const orgSection = config.sections.find((s) => s.id === `org`)
      expect(orgSection?.label).toBe(`Organization`)
      expect(orgSection?.header).toBe(`Organization`)
    })

    it(`should have visible function for org section`, () => {
      const config = getRailNavConfig(orgCtx)
      const orgSection = config.sections.find((s) => s.id === `org`)
      expect(orgSection?.visible).toBeDefined()
      expect(orgSection?.visible?.(orgCtx)).toBe(true)
      expect(orgSection?.visible?.({})).toBe(false)
    })

    it(`should have visible function for project section`, () => {
      const config = getRailNavConfig(orgCtx)
      const projectSection = config.sections.find((s) => s.id === `project`)
      expect(projectSection?.visible).toBeDefined()
      expect(projectSection?.visible?.(orgCtx)).toBe(false)
      expect(projectSection?.visible?.({ orgId: `org-123`, projectId: `proj-1` })).toBe(
        true
      )
    })

    it(`should have OrgSubNavGroups on org section`, () => {
      const config = getRailNavConfig(orgCtx)
      const orgSection = config.sections.find((s) => s.id === `org`)
      expect(orgSection?.groups).toHaveLength(3)
      const labels = orgSection?.groups.map((g) => g.label)
      expect(labels).toEqual([`Resources`, `Security`, `Management`])
    })

    it(`should have project groups from buildProjectSubNav`, () => {
      const config = getRailNavConfig(orgCtx)
      const projectSection = config.sections.find((s) => s.id === `project`)
      expect(projectSection?.groups).toHaveLength(3)
      const labels = projectSection?.groups.map((g) => g.label)
      expect(labels).toEqual([`Development`, `Security`, `Management`])
    })

    it(`should use default project label when project name is missing`, () => {
      const config = getRailNavConfig(orgCtx)
      const projectSection = config.sections.find((s) => s.id === `project`)
      expect(projectSection?.label).toBe(`Project`)
      expect(projectSection?.header).toBe(`Project`)
    })
  })

  describe(`with full context`, () => {
    const fullCtx: TNavCtx = {
      orgId: `org-123`,
      org: { name: `Engineering` } as any,
      projectId: `project-456`,
      project: { name: `API Gateway` } as any,
    }

    it(`should return Org and Project sections`, () => {
      const config = getRailNavConfig(fullCtx)
      expect(config.sections).toHaveLength(2)
      const ids = config.sections.map((s) => s.id)
      expect(ids).toEqual([`org`, `project`])
    })

    it(`should use project name as label and header`, () => {
      const config = getRailNavConfig(fullCtx)
      const projectSection = config.sections.find((s) => s.id === `project`)
      expect(projectSection?.label).toBe(`API Gateway`)
      expect(projectSection?.header).toBe(`API Gateway`)
    })

    it(`should use default project label when name is empty`, () => {
      const config = getRailNavConfig({
        orgId: `org-123`,
        projectId: `project-456`,
      })
      const projectSection = config.sections.find((s) => s.id === `project`)
      expect(projectSection?.label).toBe(`Project`)
    })

    it(`should have Icons on all sections`, () => {
      const config = getRailNavConfig(fullCtx)
      config.sections.forEach((section) => {
        expect(section.Icon).toBeDefined()
      })
    })
  })

  describe(`section ordering`, () => {
    it(`should have Org before Project`, () => {
      const config = getRailNavConfig({ orgId: `org-1`, projectId: `proj-1` })
      const ids = config.sections.map((s) => s.id)
      expect(ids.indexOf(`org`)).toBeLessThan(ids.indexOf(`project`))
    })
  })

  describe(`bottom items`, () => {
    it(`should always include Settings`, () => {
      const config = getRailNavConfig({})
      expect(config.bottomItems.some((i) => i.text === `Settings`)).toBe(true)
    })

    it(`should have static paths`, () => {
      const config = getRailNavConfig({})
      config.bottomItems.forEach((item) => {
        expect(typeof item.to).toBe(`string`)
      })
    })

    it(`should have Icons`, () => {
      const config = getRailNavConfig({})
      config.bottomItems.forEach((item) => {
        expect(item.Icon).toBeDefined()
      })
    })
  })
})
