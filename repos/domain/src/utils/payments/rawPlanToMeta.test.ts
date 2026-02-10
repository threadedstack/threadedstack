import { describe, it, expect } from 'vitest'
import { rawPlanToMeta } from './rawPlanToMeta'

describe(`rawPlanToMeta`, () => {
  it(`should convert snake_case keys to camelCase`, () => {
    const raw = {
      org_secrets: '10',
      project_secrets: '20',
      function_calls: '100',
    } as any

    const result = rawPlanToMeta(raw)

    expect(result).toHaveProperty('orgSecrets', 10)
    expect(result).toHaveProperty('projectSecrets', 20)
    expect(result).toHaveProperty('functionCalls', 100)
  })

  it(`should preserve already camelCase keys`, () => {
    const raw = {
      price: '29',
      runtime: '3600',
      threads: '50',
      members: '10',
      messages: '1000',
      projects: '5',
      endpoints: '20',
      retention: '12',
    } as any

    const result = rawPlanToMeta(raw)

    expect(result.price).toBe(29)
    expect(result.runtime).toBe(3600)
    expect(result.threads).toBe(50)
    expect(result.members).toBe(10)
    expect(result.messages).toBe(1000)
    expect(result.projects).toBe(5)
    expect(result.endpoints).toBe(20)
    expect(result.retention).toBe(12)
  })

  it(`should convert string number values to actual numbers`, () => {
    const raw = {
      price: '99',
      runtime: '7200',
    } as any

    const result = rawPlanToMeta(raw)

    expect(result.price).toBe(99)
    expect(typeof result.price).toBe('number')
    expect(result.runtime).toBe(7200)
    expect(typeof result.runtime).toBe('number')
  })

  it(`should handle string "0" correctly`, () => {
    const raw = { price: '0' } as any
    const result = rawPlanToMeta(raw)
    expect(result.price).toBe(0)
  })

  it(`should handle an empty raw plan object`, () => {
    const result = rawPlanToMeta({} as any)
    expect(result).toEqual({})
  })

  it(`should convert a full raw plan to meta`, () => {
    const raw = {
      price: '29',
      runtime: '3600',
      threads: '50',
      members: '10',
      messages: '1000',
      projects: '5',
      endpoints: '20',
      retention: '12',
      org_secrets: '10',
      organizations: '1',
      function_calls: '500',
      project_secrets: '30',
    }

    const result = rawPlanToMeta(raw)

    expect(result).toEqual({
      price: 29,
      runtime: 3600,
      threads: 50,
      members: 10,
      messages: 1000,
      projects: 5,
      endpoints: 20,
      retention: 12,
      orgSecrets: 10,
      organizations: 1,
      functionCalls: 500,
      projectSecrets: 30,
    })
  })
})
