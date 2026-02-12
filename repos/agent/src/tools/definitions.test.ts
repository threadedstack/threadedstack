import { describe, it, expect } from 'vitest'
import { allToolDefs, getToolDefs } from '@TAG/tools/definitions/definitions'

const expectedToolNames = [
  `readFile`,
  `writeFile`,
  `listDir`,
  `deleteFile`,
  `mkdir`,
  `fileExists`,
  `shellExec`,
  `webSearch`,
]

describe(`Tool definitions`, () => {
  describe(`allToolDefs`, () => {
    it(`should contain 8 tool definitions`, () => {
      expect(allToolDefs).toHaveLength(8)
    })

    it(`should include all expected tool names`, () => {
      const names = allToolDefs.map((t) => t.name)
      for (const expected of expectedToolNames) {
        expect(names).toContain(expected)
      }
    })

    it(`should include all fs tools`, () => {
      const names = allToolDefs.map((t) => t.name)
      expect(names).toContain(`readFile`)
      expect(names).toContain(`writeFile`)
      expect(names).toContain(`listDir`)
      expect(names).toContain(`deleteFile`)
      expect(names).toContain(`mkdir`)
      expect(names).toContain(`fileExists`)
    })

    it(`should include shell tools`, () => {
      const names = allToolDefs.map((t) => t.name)
      expect(names).toContain(`shellExec`)
    })

    it(`should include web tools`, () => {
      const names = allToolDefs.map((t) => t.name)
      expect(names).toContain(`webSearch`)
    })

    it(`should have name, description, and inputSchema on every tool`, () => {
      for (const tool of allToolDefs) {
        expect(tool).toHaveProperty(`name`)
        expect(tool).toHaveProperty(`description`)
        expect(tool).toHaveProperty(`inputSchema`)
        expect(tool.name).toBeTruthy()
        expect(tool.description).toBeTruthy()
      }
    })

    it(`should have valid inputSchema with type, properties, and required on every tool`, () => {
      for (const tool of allToolDefs) {
        expect(tool.inputSchema.type).toBe(`object`)
        expect(tool.inputSchema.properties).toBeDefined()
        expect(typeof tool.inputSchema.properties).toBe(`object`)
        expect(tool.inputSchema.required).toBeDefined()
        expect(Array.isArray(tool.inputSchema.required)).toBe(true)
        expect(tool.inputSchema.required!.length).toBeGreaterThan(0)
      }
    })
  })

  describe(`getToolDefs`, () => {
    it(`should return all tools when no args provided`, () => {
      const result = getToolDefs()
      expect(result).toEqual(allToolDefs)
      expect(result).toHaveLength(8)
    })

    it(`should return all tools when empty array provided`, () => {
      const result = getToolDefs([])
      expect(result).toEqual(allToolDefs)
      expect(result).toHaveLength(8)
    })

    it(`should filter to only the requested tools`, () => {
      const result = getToolDefs([`readFile`, `shellExec`])
      expect(result).toHaveLength(2)
      expect(result.map((t) => t.name)).toEqual([`readFile`, `shellExec`])
    })

    it(`should return empty array for non-existent tool names`, () => {
      const result = getToolDefs([`nonExistent`])
      expect(result).toHaveLength(0)
    })

    it(`should handle mixed existing and non-existing tool names`, () => {
      const result = getToolDefs([`readFile`, `nonExistent`, `webSearch`])
      expect(result).toHaveLength(2)
      expect(result.map((t) => t.name)).toEqual([`readFile`, `webSearch`])
    })
  })
})
