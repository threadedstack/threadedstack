/**
 * Constants for the agent self-direction (sensing) system.
 * Mirrors the skill-proposal conventions: the runtime brain (claude -p) emits
 * fenced structured-output blocks that the scheduler executor parses server-side.
 */

/** Fence label for self-sensed task proposals parsed from runtime stdout. */
export const TasksBlockFence = `tdsk-tasks`

/** Fence label for task pickups (a promoted proposal linked to its PR) parsed from runtime stdout. */
export const TaskPickupsBlockFence = `tdsk-task-picked`

/** Maximum task proposals accepted from a single agent run. */
export const TaskMaxProposalsPerRun = 5

/** Maximum characters allowed in a single task proposal's description. */
export const TaskMaxDescriptionChars = 6000

/** Maximum characters allowed in a single task proposal's evidence. */
export const TaskMaxEvidenceChars = 4000

/** Maximum scanned proposals injected into the work-cycle backlog prompt. */
export const TaskBacklogInjectMax = 12

/** Maximum characters of backlog context injected into a prompt. */
export const TaskBacklogInjectMaxChars = 8000

/**
 * Maximum recent org runs the sensor scans for run-outcome anomalies. The sensor
 * runs every 2h and ~15-20 schedule runs land per hour, so a 15-run window
 * covers under an hour — an anomaly (e.g. a deploy-severed work cycle) from
 * earlier in the 2h gap ages out before the sensor looks. 50 covers the full
 * inter-sensor window with margin. Only the anomalies are injected, and the
 * output is bounded by RunOutcomeInjectMaxChars, so a larger scan is cheap.
 */
export const RunOutcomeInjectMax = 50

/** Maximum characters of run-outcome context injected into a prompt. */
export const RunOutcomeInjectMaxChars = 6000

/** Minimum duration (ms) an empty run must last before it is treated as a no-op. */
export const EmptyRunDurationMs = 15000

/** Maximum characters of coordinator initiative context injected into a prompt. */
export const CoordinatorInjectMaxChars = 8000
