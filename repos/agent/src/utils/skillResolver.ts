import type { Skill } from '@tdsk/domain'

export type TResolvedSkills = {
  instructions: string
  tools: string[]
}

/**
 * Resolve which skills are active for the current prompt.
 * Active = alwaysActive OR triggerKeywords match the prompt.
 */
export const resolveActiveSkills = (skills: Skill[], prompt: string): TResolvedSkills => {
  if (!skills?.length) return { instructions: ``, tools: [] }

  const promptLower = prompt.toLowerCase()

  const active = skills.filter((skill) => {
    if (skill.alwaysActive) return true
    if (!skill.triggerKeywords?.length) return false
    return skill.triggerKeywords.some((kw) => promptLower.includes(kw.toLowerCase()))
  })

  if (!active.length) return { instructions: ``, tools: [] }

  const instructions = active.map((s) => `## ${s.name}\n${s.instructions}`).join(`\n\n`)

  const tools = [...new Set(active.flatMap((s) => s.tools || []))]

  return {
    instructions: `\n\n# Active Skills\n\n${instructions}`,
    tools,
  }
}
