import type { Skill } from '@tdsk/domain'

/**
 * Resolved skills with merged instructions and tools.
 */
export type TResolvedSkills = {
  instructions: string
  tools: string[]
  activeSkills: Skill[]
}

/**
 * Resolve active skills for an agent based on the user prompt.
 * Returns always-active skills + keyword-triggered skills.
 */
export const resolveActiveSkills = (skills: Skill[], prompt: string): TResolvedSkills => {
  if (!skills?.length) return { instructions: ``, tools: [], activeSkills: [] }

  const promptLower = prompt.toLowerCase()

  const activeSkills = skills.filter((skill) => {
    if (skill.alwaysActive) return true
    if (!skill.triggerKeywords?.length) return false
    return skill.triggerKeywords.some((kw) => promptLower.includes(kw.toLowerCase()))
  })

  if (!activeSkills.length) return { instructions: ``, tools: [], activeSkills: [] }

  const instructions = activeSkills
    .map((s) => `## ${s.name}\n${s.instructions}`)
    .join(`\n\n`)

  const tools = [...new Set(activeSkills.flatMap((s) => s.tools || []))]

  return {
    instructions: `\n\n# Active Skills\n\n${instructions}`,
    tools,
    activeSkills,
  }
}
