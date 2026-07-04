import { describe, it, expect } from 'vitest'
import {
  MemorySearchTopK,
  MemoryRecencyDecay,
  MemoryMaxTextChars,
  MemoriesBlockFence,
  MemoryMaxImportance,
  MemoryMinImportance,
  MemoryInjectMaxChars,
  MemoryEmbeddingDimensions,
} from './memory'

describe(`Memory constants`, () => {
  it(`defines the hourly recency decay factor`, () => {
    expect(MemoryRecencyDecay).toBe(0.995)
    expect(MemoryRecencyDecay).toBeGreaterThan(0)
    expect(MemoryRecencyDecay).toBeLessThan(1)
  })

  it(`defines the default search top-k`, () => {
    expect(MemorySearchTopK).toBe(8)
  })

  it(`defines the text and injection character caps`, () => {
    expect(MemoryMaxTextChars).toBe(4000)
    expect(MemoryInjectMaxChars).toBe(6000)
  })

  it(`defines importance bounds 1..10`, () => {
    expect(MemoryMinImportance).toBe(1)
    expect(MemoryMaxImportance).toBe(10)
    expect(MemoryMinImportance).toBeLessThan(MemoryMaxImportance)
  })

  it(`defines the pgvector embedding dimension`, () => {
    expect(MemoryEmbeddingDimensions).toBe(1024)
  })

  it(`defines the structured-output block fence`, () => {
    expect(MemoriesBlockFence).toBe(`tdsk-memories`)
  })
})
