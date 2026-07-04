/**
 * Injected skill provider for the api-brain agent (P3b self-improvement).
 * Mirrors the IMemoryProvider pattern: the agent package declares the capability
 * contract, the backend implements it (skill + skillProposal db services + the
 * security scan) and injects an instance through the AgentRunner init opts.
 */
export interface ISkillProvider {
  /**
   * Author a new skill PROPOSAL (not an active skill). The backend runs a
   * deterministic security scan and returns the resulting status; a scanned
   * proposal is later promoted by the auditor/curator, a failed one is rejected.
   */
  authorSkill(input: {
    name: string
    description: string
    instructions: string
    tools?: string[]
    triggerKeywords?: string[]
    alwaysActive?: boolean
    meta?: Record<string, any>
  }): Promise<{ id: string; status: string; findings: string[] }>

  /** List the agent's active skills (progressive disclosure). */
  listSkills(): Promise<
    Array<{
      id: string
      name: string
      description: string
      alwaysActive: boolean
      triggerKeywords: string[]
    }>
  >

  /** Full detail of one active skill, or null when not found / not the agent's. */
  viewSkill(id: string): Promise<{
    id: string
    name: string
    description: string
    instructions: string
    tools: string[]
    triggerKeywords: string[]
    alwaysActive: boolean
  } | null>
}
