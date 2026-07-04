import { Memory } from './memory'
import { EMemoryKind } from '@TDM/types'
import { describe, it, expect } from 'vitest'

describe(`Memory Model`, () => {
  describe(`constructor`, () => {
    it(`should create a memory with required fields`, () => {
      const memoryData = {
        id: `mm_abc1234`,
        orgId: `og_0000001`,
        agentId: `ag_lvUbjp_`,
        kind: EMemoryKind.fact,
        text: `The steward runs an hourly observer cycle`,
        importance: 7,
        lastAccessedAt: `2026-07-03T00:00:00Z`,
        createdAt: `2026-07-03T00:00:00Z`,
        updatedAt: `2026-07-03T00:00:00Z`,
      }

      const memory = new Memory(memoryData)

      expect(memory.id).toBe(memoryData.id)
      expect(memory.orgId).toBe(memoryData.orgId)
      expect(memory.agentId).toBe(memoryData.agentId)
      expect(memory.kind).toBe(EMemoryKind.fact)
      expect(memory.text).toBe(memoryData.text)
      expect(memory.importance).toBe(7)
      expect(memory.lastAccessedAt).toBe(memoryData.lastAccessedAt)
      expect(memory.createdAt).toBe(memoryData.createdAt)
      expect(memory.updatedAt).toBe(memoryData.updatedAt)
    })

    it(`should default kind to fact, importance to 5, and embedding/meta to null`, () => {
      const memory = new Memory({
        id: `mm_abc1234`,
        orgId: `og_0000001`,
        agentId: `ag_lvUbjp_`,
        text: `A default memory`,
      })

      expect(memory.kind).toBe(EMemoryKind.fact)
      expect(memory.importance).toBe(5)
      expect(memory.embedding).toBeNull()
      expect(memory.meta).toBeNull()
    })

    it(`should accept an embedding vector and citation meta`, () => {
      const embedding = [0.1, 0.2, 0.3]
      const meta = { threadId: `th_abc1234`, messageId: `ms_abc1234` }
      const memory = new Memory({
        id: `mm_abc1234`,
        orgId: `og_0000001`,
        agentId: `ag_lvUbjp_`,
        kind: EMemoryKind.insight,
        text: `An embedded insight`,
        embedding,
        meta,
      })

      expect(memory.kind).toBe(EMemoryKind.insight)
      expect(memory.embedding).toEqual(embedding)
      expect(memory.meta).toEqual(meta)
    })

    it(`should handle every memory kind`, () => {
      for (const kind of Object.values(EMemoryKind)) {
        const memory = new Memory({
          id: `mm_abc1234`,
          orgId: `og_0000001`,
          agentId: `ag_lvUbjp_`,
          kind,
          text: `A ${kind} memory`,
        })

        expect(memory.kind).toBe(kind)
      }
    })
  })

  describe(`inheritance from Base`, () => {
    it(`should inherit Base properties`, () => {
      const memory = new Memory({
        id: `mm_abc1234`,
        orgId: `og_0000001`,
        agentId: `ag_lvUbjp_`,
        text: `Hello`,
        createdAt: `2026-07-03T00:00:00Z`,
        updatedAt: `2026-07-03T00:00:00Z`,
      })

      expect(memory).toHaveProperty(`id`)
      expect(memory).toHaveProperty(`createdAt`)
      expect(memory).toHaveProperty(`updatedAt`)
    })
  })
})
