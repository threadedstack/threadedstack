/**
 * Constants for the executive-board faculty. The board itself runs on the
 * platform primitives — Collections for state, Functions invoked via the
 * `tdsk-actions` surface for effects (see `repos/database/src/seeds/exec-board/`).
 * The read-only `## Business metrics` snapshot is the one computed context that
 * remains a platform helper (`repos/backend/src/utils/agent/businessMetrics.ts`),
 * capped by the constant here.
 */

/** Maximum characters of Business metrics context injected into an exec cycle prompt. */
export const BusinessMetricsInjectMaxChars = 4000
