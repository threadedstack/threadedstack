import type { TScanResult, TSkillAuthorInput } from '@tdsk/domain'

import { EAgentTool } from '@tdsk/domain'

import { scanText } from './textScan'

/**
 * Deterministic security scan for self-authored skill proposals (P3b).
 *
 * Skills feed straight into the agent prompt and can activate gated tools, so a
 * poisoned or self-authored skill is a direct prompt-injection / privilege-
 * escalation vector. This scan is the HARD GATE in the promotion pipeline: it
 * runs at authoring time and AGAIN before promotion, and is FAIL-CLOSED — any
 * finding blocks the proposal regardless of the auditor's semantic verdict.
 *
 * It is intentionally conservative (favouring false-positives over letting a
 * dangerous skill through); a rejected agent can rephrase and re-propose.
 *
 * The text-scan half (pattern registry + normalization) lives in `./textScan`
 * and is shared with the task-proposal scan (P4a); this module adds the
 * skill-specific tool-allowlist checks on top.
 */

/**
 * Agent tools a self-authored skill may activate without review escalation.
 * EAgentTool.delegateTask and authorSkill are DELIBERATELY excluded: a
 * self-authored skill must not be able to grant itself delegation (child
 * process spawning) or recursive skill authoring — fail closed and let a
 * human widen this list if a real need appears.
 */
const SafeSkillTools = new Set<string>([
  EAgentTool.mkdir,
  EAgentTool.listDir,
  EAgentTool.readFile,
  EAgentTool.webFetch,
  EAgentTool.webSearch,
  EAgentTool.writeFile,
  EAgentTool.shellExec,
  EAgentTool.deleteFile,
  EAgentTool.fileExists,
  EAgentTool.evalCode,
  EAgentTool.createArtifact,
  EAgentTool.memoryWrite,
  EAgentTool.memorySearch,
  EAgentTool.skillsList,
  EAgentTool.skillView,
])

/**
 * Run the deterministic scan over a proposal. Returns `{ passed, findings }`;
 * `passed` is false whenever any finding is present (fail-closed).
 */
export const scanSkillProposal = (
  proposal: Pick<
    TSkillAuthorInput,
    `name` | `description` | `instructions` | `tools` | `triggerKeywords`
  >
): TScanResult => {
  // Scan every field that reaches the model prompt: name/description/instructions
  // AND triggerKeywords + tool names (all surfaced via skillView / activation).
  const { findings } = scanText(
    [
      proposal.name,
      proposal.description,
      proposal.instructions,
      ...(proposal.triggerKeywords ?? []),
      ...(proposal.tools ?? []),
    ].join(`\n`)
  )

  // Tool escalation: unknown tool names (typo / injected) and self-replication
  // (a skill that grants skill-authoring) are flagged.
  for (const tool of proposal.tools ?? []) {
    if (tool === EAgentTool.authorSkill)
      findings.push(`[tool-escalation] skill grants authorSkill (self-replication)`)
    else if (!SafeSkillTools.has(tool))
      findings.push(`[tool-escalation] unknown or disallowed tool "${tool}"`)
  }

  return { passed: findings.length === 0, findings }
}
