/**
 * Constants for the agent self-improvement (skill authoring) system.
 * Mirrors the memory-block conventions: the runtime brain (claude -p) emits
 * fenced structured-output blocks that the scheduler executor parses server-side.
 */

/** Fence label for self-authored skill proposals parsed from runtime stdout. */
export const SkillsBlockFence = `tdsk-skills`

/** Fence label for auditor review decisions parsed from runtime stdout. */
export const SkillReviewsBlockFence = `tdsk-skill-reviews`

/** Maximum characters allowed in a single skill proposal's instructions. */
export const SkillMaxInstructionsChars = 8000

/** Maximum skill proposals accepted from a single agent run. */
export const SkillMaxProposalsPerRun = 3

/** Maximum scanned proposals injected into an auditor review prompt. */
export const SkillReviewInjectMax = 10

/** Maximum characters of proposal-review context injected into a prompt. */
export const SkillReviewInjectMaxChars = 8000
