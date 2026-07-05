import type { TScanResult, TTaskProposalInput } from '@tdsk/domain'

import { scanText } from './textScan'

/**
 * Deterministic security scan for self-sensed task proposals (P4a).
 *
 * Task-proposal text (title/description/evidence/sourceSignal) is injected
 * into the steward's work-cycle prompt, so it is a prompt-injection vector
 * exactly like a skill proposal — scan every field that reaches the model.
 * Lighter than the skill scan: tasks grant no tools, so there is no
 * tool-allowlist check here. Fail-closed, identical text-scan semantics to
 * the skill scan (same shared `scanText` engine from `./textScan`).
 */
export const scanTaskProposal = (
  p: Pick<TTaskProposalInput, `title` | `description` | `evidence` | `sourceSignal`>
): TScanResult =>
  scanText([p.title, p.description, p.evidence, p.sourceSignal].join(`\n`))
