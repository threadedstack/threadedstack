import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TSandboxSkillLink } from '@tdsk/domain'

import { SandboxHomePath } from '@tdsk/domain'
import { resolveSkillFiles } from './resolveSkillFiles'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const makeLink = (
  name: string,
  instructions: string,
  priority = 0
): TSandboxSkillLink => ({
  id: `link-${name}`,
  skillId: `skill-${name}`,
  sandboxId: `sb-1`,
  priority,
  skill: {
    id: `skill-${name}`,
    name,
    description: `desc`,
    instructions,
    alwaysActive: false,
    orgId: `org-1`,
  },
})

describe(`resolveSkillFiles`, () => {
  let logger: { warn: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import(`@TBE/utils/logger`)
    logger = mod.logger as unknown as { warn: ReturnType<typeof vi.fn> }
  })

  it(`returns null for runtime not in RuntimeSkillPathMap and no customSkillPath`, () => {
    const result = resolveSkillFiles(`custom`, [], undefined)
    expect(result).toBeNull()
  })

  it(`returns null for empty skillLinks array`, () => {
    const result = resolveSkillFiles(`claude-code`, [], undefined)
    expect(result).toBeNull()
  })

  it(`returns null when all skills have empty instructions`, () => {
    const links = [makeLink(`skill-a`, ``), makeLink(`skill-b`, ``)]
    const result = resolveSkillFiles(`claude-code`, links, undefined)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledTimes(2)
  })

  it(`returns null when skill name produces empty slug`, () => {
    const links = [makeLink(`!!!`, `some instructions`)]
    const result = resolveSkillFiles(`claude-code`, links, undefined)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`produces empty slug`)
    )
  })

  it(`claudeCode runtime uses nested layout`, () => {
    const links = [makeLink(`my-skill`, `Do X`)]
    const result = resolveSkillFiles(`claude-code`, links, undefined)
    expect(result).not.toBeNull()
    expect(result!.files[0].path).toBe(`my-skill/SKILL.md`)
    expect(result!.mountPath).toBe(`${SandboxHomePath}/.claude/skills`)
  })

  it(`codex runtime uses flat layout`, () => {
    const links = [makeLink(`my-skill`, `Do X`)]
    const result = resolveSkillFiles(`codex`, links, undefined)
    expect(result).not.toBeNull()
    expect(result!.files[0].path).toBe(`my-skill.md`)
    expect(result!.mountPath).toBe(`${SandboxHomePath}/.codex/skills`)
  })

  it(`openCode runtime uses flat layout`, () => {
    const links = [makeLink(`my-skill`, `Do X`)]
    const result = resolveSkillFiles(`opencode`, links, undefined)
    expect(result).not.toBeNull()
    expect(result!.files[0].path).toBe(`my-skill.md`)
    expect(result!.mountPath).toBe(`${SandboxHomePath}/.opencode/prompts`)
  })

  it(`geminiCli runtime uses flat layout`, () => {
    const links = [makeLink(`my-skill`, `Do X`)]
    const result = resolveSkillFiles(`gemini-cli`, links, undefined)
    expect(result).not.toBeNull()
    expect(result!.files[0].path).toBe(`my-skill.md`)
    expect(result!.mountPath).toBe(`${SandboxHomePath}/.gemini/skills`)
  })

  it(`customSkillPath overrides runtime basePath`, () => {
    const links = [makeLink(`my-skill`, `Do X`)]
    const result = resolveSkillFiles(`claude-code`, links, `/custom/path`)
    expect(result).not.toBeNull()
    expect(result!.mountPath).toBe(`/custom/path`)
    expect(result!.files[0].path).toBe(`my-skill/SKILL.md`)
  })

  it(`customSkillPath with tilde expands to SandboxHomePath`, () => {
    const links = [makeLink(`my-skill`, `Do X`)]
    const result = resolveSkillFiles(`claude-code`, links, `~/my-skills`)
    expect(result).not.toBeNull()
    expect(result!.mountPath).toBe(`${SandboxHomePath}/my-skills`)
  })

  it(`skips skill with no instructions and warns`, () => {
    const links = [makeLink(`empty-skill`, ``), makeLink(`valid-skill`, `Do Y`)]
    const result = resolveSkillFiles(`claude-code`, links, undefined)
    expect(result).not.toBeNull()
    expect(result!.files).toHaveLength(1)
    expect(result!.files[0].key).toBe(`skill-valid-skill`)
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`empty instructions`)
    )
  })

  it(`skips duplicate slug and warns`, () => {
    const links = [
      makeLink(`My Skill`, `Instructions A`, 0),
      makeLink(`my-skill`, `Instructions B`, 1),
    ]
    const result = resolveSkillFiles(`codex`, links, undefined)
    expect(result).not.toBeNull()
    expect(result!.files).toHaveLength(1)
    expect(result!.configMapData[`skill-my-skill`]).toBe(`Instructions A`)
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`Duplicate skill slug`)
    )
  })

  it(`configMapData key format is skill-{slug}`, () => {
    const links = [makeLink(`my-skill`, `Do X`)]
    const result = resolveSkillFiles(`codex`, links, undefined)
    expect(result).not.toBeNull()
    expect(result!.configMapData).toHaveProperty(`skill-my-skill`)
    expect(result!.files[0].key).toBe(`skill-my-skill`)
  })

  it(`skills sorted by priority ascending`, () => {
    const links = [
      makeLink(`skill-two`, `Do Two`, 2),
      makeLink(`skill-zero`, `Do Zero`, 0),
      makeLink(`skill-one`, `Do One`, 1),
    ]
    const result = resolveSkillFiles(`codex`, links, undefined)
    expect(result).not.toBeNull()
    expect(result!.files[0].key).toBe(`skill-skill-zero`)
    expect(result!.files[1].key).toBe(`skill-skill-one`)
    expect(result!.files[2].key).toBe(`skill-skill-two`)
  })

  it(`skill with undefined priority treated as 0`, () => {
    const linkUndefined: TSandboxSkillLink = {
      id: `link-undef`,
      skillId: `skill-undef`,
      sandboxId: `sb-1`,
      priority: undefined as unknown as number,
      skill: {
        id: `skill-undef`,
        name: `skill-undef`,
        description: `desc`,
        instructions: `Do Undef`,
        alwaysActive: false,
        orgId: `org-1`,
      },
    }
    const linkOne = makeLink(`skill-one`, `Do One`, 1)
    const result = resolveSkillFiles(`codex`, [linkOne, linkUndefined], undefined)
    expect(result).not.toBeNull()
    expect(result!.files[0].key).toBe(`skill-skill-undef`)
    expect(result!.files[1].key).toBe(`skill-skill-one`)
  })
})
