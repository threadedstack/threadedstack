/**
 * Constants for the agent verification system (P4c).
 * Mirrors the escalation conventions: the runtime brain emits fenced
 * structured-output blocks that the executor parses server-side.
 */

import type { TVerifyProbe } from '@TDM/types/verification.types'
import { EVerifyProbeKind } from '@TDM/types/verification.types'

/** The fenced block a PR body uses to DECLARE its verify probe. Default when absent. */
export const VerifyDeclareBlockFence = `tdsk-verify`

/** The fenced block the verify cycle emits with results. */
export const VerifyResultsBlockFence = `tdsk-verify-results`

/** Default probe when a PR body carries no tdsk-verify block. */
export const DefaultVerifyProbe: TVerifyProbe = { kind: EVerifyProbeKind.ciGreen }

/** Maximum verify injections accepted into a prompt. */
export const VerifyInjectMax = 20

/** Maximum characters of verify context injected into a prompt. */
export const VerifyInjectMaxChars = 8000

/** How many recent steward PRs the cycle lists via gh; older PRs age out naturally. */
export const VerifyLookbackPrs = 20
