/**
 * Constants for the agent escalation system (P4b).
 * Mirrors the task-proposal conventions: the runtime brain emits fenced
 * structured-output blocks that the executor parses server-side.
 */

import type { TEscalationTarget } from '@TDM/types'
import { EEscalationTarget } from '@TDM/types'

/** Fence label for escalations parsed from runtime stdout. */
export const EscalationsBlockFence = `tdsk-escalations`

/** Fence label for escalation resolutions parsed from runtime stdout. */
export const EscalationResolutionsBlockFence = `tdsk-escalation-resolutions`

/** Maximum escalations accepted from a single agent run. */
export const EscalationMaxPerRun = 3

/** Maximum open escalations injected into a prompt. */
export const EscalationInjectMax = 15

/** Maximum characters of escalation context injected into a prompt. */
export const EscalationInjectMaxChars = 8000

/**
 * Targets the steward can auto-route to a faculty it already has.
 * Extend with ops/infra when P4d/P4e ship.
 */
export const EscalationRoutableTargets: TEscalationTarget[] = [EEscalationTarget.app]
