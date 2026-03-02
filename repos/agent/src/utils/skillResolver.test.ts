import { describe, it, expect } from 'vitest'
import { Skill } from '@tdsk/domain'
import { resolveActiveSkills } from './skillResolver'

const makeSkill = (overrides: Partial<Skill> = {}) =>
  new Skill({
    id: `skill-1`,
    name: `Test Skill`,
    orgId: `org-1`,
    description: `A test skill`,
    instructions: `Do the thing`,
    tools: [],
    triggerKeywords: [],
    alwaysActive: false,
    ...overrides,
  })

describe(`resolveActiveSkills`, () => {
  it(`should return empty when no skills provided`, () => {
    const result = resolveActiveSkills([], `hello`)
    expect(result.instructions).toBe(``)
    expect(result.tools).toEqual([])
  })

  it(`should include always-active skills`, () => {
    const skills = [makeSkill({ alwaysActive: true, name: `Always On` })]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.instructions).toContain(`Always On`)
  })

  it(`should include keyword-triggered skills when prompt matches`, () => {
    const skills = [
      makeSkill({ triggerKeywords: [`deploy`, `release`], name: `Deploy Skill` }),
    ]
    const result = resolveActiveSkills(skills, `Please deploy the app`)
    expect(result.instructions).toContain(`Deploy Skill`)
  })

  it(`should be case-insensitive for keyword matching`, () => {
    const skills = [makeSkill({ triggerKeywords: [`Deploy`], name: `Deploy Skill` })]
    const result = resolveActiveSkills(skills, `please DEPLOY the app`)
    expect(result.instructions).toContain(`Deploy Skill`)
  })

  it(`should NOT include keyword-triggered skills when no match`, () => {
    const skills = [makeSkill({ triggerKeywords: [`deploy`], name: `Deploy Skill` })]
    const result = resolveActiveSkills(skills, `hello world`)
    expect(result.instructions).toBe(``)
  })

  it(`should merge tools from active skills without duplicates`, () => {
    const skills = [
      makeSkill({ id: `s1`, alwaysActive: true, tools: [`shellExec`, `readFile`] }),
      makeSkill({ id: `s2`, alwaysActive: true, tools: [`shellExec`, `writeFile`] }),
    ]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.tools).toEqual([`shellExec`, `readFile`, `writeFile`])
  })

  it(`should skip skills with no keywords and not always-active`, () => {
    const skills = [makeSkill({ triggerKeywords: [], alwaysActive: false })]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.instructions).toBe(``)
  })

  it(`should format instructions with skill name headers`, () => {
    const skills = [
      makeSkill({ id: `s1`, alwaysActive: true, name: `Skill A`, instructions: `Do A` }),
      makeSkill({ id: `s2`, alwaysActive: true, name: `Skill B`, instructions: `Do B` }),
    ]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.instructions).toContain(`# Active Skills`)
    expect(result.instructions).toContain(`## Skill A`)
    expect(result.instructions).toContain(`Do A`)
    expect(result.instructions).toContain(`## Skill B`)
    expect(result.instructions).toContain(`Do B`)
  })

  it(`should handle null/undefined skills array`, () => {
    const result = resolveActiveSkills(null as any, `hello`)
    expect(result.instructions).toBe(``)
    expect(result.tools).toEqual([])
  })

  it(`should handle undefined skills array`, () => {
    const result = resolveActiveSkills(undefined as any, `hello`)
    expect(result.instructions).toBe(``)
    expect(result.tools).toEqual([])
  })

  it(`should handle skills with no tools property`, () => {
    const skills = [makeSkill({ alwaysActive: true, tools: undefined as any })]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.tools).toEqual([])
  })

  it(`should combine always-active and keyword-triggered skills`, () => {
    const skills = [
      makeSkill({ id: `s1`, alwaysActive: true, name: `Always` }),
      makeSkill({ id: `s2`, triggerKeywords: [`code`], name: `Coding` }),
    ]
    const result = resolveActiveSkills(skills, `write some code`)
    expect(result.instructions).toContain(`Always`)
    expect(result.instructions).toContain(`Coding`)
  })

  it(`should match multiple keywords from the same skill`, () => {
    const skills = [
      makeSkill({
        triggerKeywords: [`deploy`, `release`, `ship`],
        name: `Release Skill`,
      }),
    ]
    const result = resolveActiveSkills(skills, `let's ship it`)
    expect(result.instructions).toContain(`Release Skill`)
  })

  it(`should return empty tools when no active skills have tools`, () => {
    const skills = [makeSkill({ alwaysActive: true, tools: [] })]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.tools).toEqual([])
  })

  it(`should handle keyword matching with partial word overlap`, () => {
    const skills = [makeSkill({ triggerKeywords: [`test`], name: `Test Skill` })]
    // "test" is contained in "testing"
    const result = resolveActiveSkills(skills, `I am testing the app`)
    expect(result.instructions).toContain(`Test Skill`)
  })

  it(`should include instructions from the skill in the output`, () => {
    const skills = [
      makeSkill({
        alwaysActive: true,
        name: `Helper`,
        instructions: `Follow these rules carefully`,
      }),
    ]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.instructions).toContain(`Follow these rules carefully`)
  })

  it(`should separate multiple skills with double newlines`, () => {
    const skills = [
      makeSkill({ id: `s1`, alwaysActive: true, name: `A`, instructions: `Inst A` }),
      makeSkill({ id: `s2`, alwaysActive: true, name: `B`, instructions: `Inst B` }),
    ]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.instructions).toContain(`## A\nInst A\n\n## B\nInst B`)
  })
})
