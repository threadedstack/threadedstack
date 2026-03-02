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

describe(`resolveActiveSkills (backend)`, () => {
  // ── EMPTY / NULL INPUT ──────────────────────────────────────────────

  it(`should return empty when no skills provided`, () => {
    const result = resolveActiveSkills([], `hello`)
    expect(result.instructions).toBe(``)
    expect(result.tools).toEqual([])
    expect(result.activeSkills).toEqual([])
  })

  it(`should handle null skills array`, () => {
    const result = resolveActiveSkills(null as any, `hello`)
    expect(result.instructions).toBe(``)
    expect(result.tools).toEqual([])
    expect(result.activeSkills).toEqual([])
  })

  it(`should handle undefined skills array`, () => {
    const result = resolveActiveSkills(undefined as any, `hello`)
    expect(result.instructions).toBe(``)
    expect(result.tools).toEqual([])
    expect(result.activeSkills).toEqual([])
  })

  // ── ALWAYS-ACTIVE ──────────────────────────────────────────────────

  it(`should include always-active skills`, () => {
    const skills = [makeSkill({ alwaysActive: true, name: `Always On` })]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.instructions).toContain(`Always On`)
    expect(result.activeSkills).toHaveLength(1)
    expect(result.activeSkills[0].name).toBe(`Always On`)
  })

  it(`should include multiple always-active skills`, () => {
    const skills = [
      makeSkill({ id: `s1`, alwaysActive: true, name: `Skill A` }),
      makeSkill({ id: `s2`, alwaysActive: true, name: `Skill B` }),
    ]
    const result = resolveActiveSkills(skills, `anything`)
    expect(result.activeSkills).toHaveLength(2)
  })

  // ── KEYWORD MATCHING ───────────────────────────────────────────────

  it(`should include keyword-triggered skills when prompt matches`, () => {
    const skills = [
      makeSkill({ triggerKeywords: [`deploy`, `release`], name: `Deploy Skill` }),
    ]
    const result = resolveActiveSkills(skills, `Please deploy the app`)
    expect(result.instructions).toContain(`Deploy Skill`)
    expect(result.activeSkills).toHaveLength(1)
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
    expect(result.activeSkills).toEqual([])
  })

  it(`should match any keyword from the list`, () => {
    const skills = [
      makeSkill({ triggerKeywords: [`deploy`, `release`, `ship`], name: `Release` }),
    ]
    const result = resolveActiveSkills(skills, `time to ship`)
    expect(result.instructions).toContain(`Release`)
  })

  // ── SKILL FILTERING ────────────────────────────────────────────────

  it(`should skip skills with no keywords and not always-active`, () => {
    const skills = [makeSkill({ triggerKeywords: [], alwaysActive: false })]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.instructions).toBe(``)
    expect(result.activeSkills).toEqual([])
  })

  it(`should combine always-active and keyword-triggered skills`, () => {
    const skills = [
      makeSkill({ id: `s1`, alwaysActive: true, name: `Always` }),
      makeSkill({ id: `s2`, triggerKeywords: [`code`], name: `Coding` }),
    ]
    const result = resolveActiveSkills(skills, `write some code`)
    expect(result.instructions).toContain(`Always`)
    expect(result.instructions).toContain(`Coding`)
    expect(result.activeSkills).toHaveLength(2)
  })

  it(`should only include keyword-matching skills, not all skills`, () => {
    const skills = [
      makeSkill({ id: `s1`, triggerKeywords: [`deploy`], name: `Deploy` }),
      makeSkill({ id: `s2`, triggerKeywords: [`test`], name: `Test` }),
    ]
    const result = resolveActiveSkills(skills, `run deploy`)
    expect(result.activeSkills).toHaveLength(1)
    expect(result.activeSkills[0].name).toBe(`Deploy`)
  })

  // ── TOOLS ──────────────────────────────────────────────────────────

  it(`should merge tools from active skills without duplicates`, () => {
    const skills = [
      makeSkill({ id: `s1`, alwaysActive: true, tools: [`shellExec`, `readFile`] }),
      makeSkill({ id: `s2`, alwaysActive: true, tools: [`shellExec`, `writeFile`] }),
    ]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.tools).toEqual([`shellExec`, `readFile`, `writeFile`])
  })

  it(`should handle skills with no tools property`, () => {
    const skills = [makeSkill({ alwaysActive: true, tools: undefined as any })]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.tools).toEqual([])
  })

  it(`should return empty tools when active skills have empty tools`, () => {
    const skills = [makeSkill({ alwaysActive: true, tools: [] })]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.tools).toEqual([])
  })

  // ── INSTRUCTIONS FORMAT ────────────────────────────────────────────

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

  it(`should include skill instructions content`, () => {
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

  it(`should separate multiple skill sections with double newlines`, () => {
    const skills = [
      makeSkill({ id: `s1`, alwaysActive: true, name: `A`, instructions: `Inst A` }),
      makeSkill({ id: `s2`, alwaysActive: true, name: `B`, instructions: `Inst B` }),
    ]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.instructions).toContain(`## A\nInst A\n\n## B\nInst B`)
  })

  // ── activeSkills RETURN VALUE ──────────────────────────────────────

  it(`should return the actual Skill objects in activeSkills`, () => {
    const skills = [
      makeSkill({
        id: `s1`,
        alwaysActive: true,
        name: `My Skill`,
        instructions: `Do stuff`,
      }),
    ]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.activeSkills[0]).toBe(skills[0])
  })

  it(`should return activeSkills in the same order as input`, () => {
    const skills = [
      makeSkill({ id: `s1`, alwaysActive: true, name: `First` }),
      makeSkill({ id: `s2`, alwaysActive: true, name: `Second` }),
      makeSkill({ id: `s3`, alwaysActive: true, name: `Third` }),
    ]
    const result = resolveActiveSkills(skills, `hello`)
    expect(result.activeSkills.map((s) => s.name)).toEqual([`First`, `Second`, `Third`])
  })
})
