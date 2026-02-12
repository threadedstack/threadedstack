import { describe, it, expect } from 'vitest'
import { allToolDefs, getToolDefs } from './definitions'

describe(`Tool definitions`, () => {
  describe(`allToolDefs`, () => {
    it(`should be a non-empty array`, () => {
      expect(Array.isArray(allToolDefs)).toBe(true)
      expect(allToolDefs.length).toBeGreaterThan(0)
    })

    it(`should have unique tool names`, () => {
      const names = allToolDefs.map((t) => t.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })

    it(`should have valid structure for each tool`, () => {
      for (const tool of allToolDefs) {
        expect(tool).toHaveProperty(`name`)
        expect(tool).toHaveProperty(`description`)
        expect(tool).toHaveProperty(`inputSchema`)
        expect(typeof tool.name).toBe(`string`)
        expect(typeof tool.description).toBe(`string`)
        expect(tool.name.length).toBeGreaterThan(0)
        expect(tool.description.length).toBeGreaterThan(0)
        expect(tool.inputSchema).toHaveProperty(`type`)
        expect(tool.inputSchema.type).toBe(`object`)
      }
    })

    it(`should include expected tool categories`, () => {
      const names = allToolDefs.map((t) => t.name)
      // fs tools
      expect(names).toContain(`readFile`)
      expect(names).toContain(`writeFile`)
      // shell tools
      expect(names).toContain(`shellExec`)
    })
  })

  describe(`getToolDefs`, () => {
    it(`should return all tools when no filter provided`, () => {
      const result = getToolDefs()
      expect(result).toEqual(allToolDefs)
    })

    it(`should return all tools when empty array provided`, () => {
      const result = getToolDefs([])
      expect(result).toEqual(allToolDefs)
    })

    it(`should filter tools by allowed names`, () => {
      const result = getToolDefs([`readFile`, `shellExec`])
      expect(result).toHaveLength(2)
      expect(result.map((t) => t.name)).toEqual([`readFile`, `shellExec`])
    })

    it(`should return empty array when no names match`, () => {
      const result = getToolDefs([`nonExistentTool`])
      expect(result).toHaveLength(0)
    })

    it(`should maintain order from allToolDefs`, () => {
      const names = allToolDefs.map((t) => t.name)
      const subset = [names[names.length - 1], names[0]]
      const result = getToolDefs(subset)

      // Result should follow allToolDefs order, not input order
      const resultNames = result.map((t) => t.name)
      const idx0 = names.indexOf(resultNames[0])
      const idx1 = names.indexOf(resultNames[1])
      expect(idx0).toBeLessThan(idx1)
    })
  })
})
