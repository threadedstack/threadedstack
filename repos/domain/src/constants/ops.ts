import { OpsActionIdPrefix } from '@TDM/constants/prefixes'

/** The seven allowlisted ops actions. NEVER add outside this list without a plan change. */
export enum EOpsAction {
  // READ tier (execute inline)
  podStatus = `podStatus`,
  podLogs = `podLogs`,
  deployState = `deployState`,
  quotaUsage = `quotaUsage`,
  // WRITE tier (propose + dry-run + adversary-review-before-execute)
  triggerRedeploy = `triggerRedeploy`,
  restartDeployment = `restartDeployment`,
  applySandboxConfig = `applySandboxConfig`,
}
export type TOpsAction = `${EOpsAction}`

export const OpsReadActions = [
  EOpsAction.podStatus,
  EOpsAction.podLogs,
  EOpsAction.deployState,
  EOpsAction.quotaUsage,
] as const
export const OpsWriteActions = [
  EOpsAction.triggerRedeploy,
  EOpsAction.restartDeployment,
  EOpsAction.applySandboxConfig,
] as const
export const isOpsWriteAction = (a: string): a is (typeof OpsWriteActions)[number] =>
  (OpsWriteActions as readonly string[]).includes(a)

/**
 * The only k8s Deployments the steward may target. Anything outside this list is
 * refused by the scan (D4). MUST match the actual prod deployment names.
 */
export const OpsAllowedDeployments = [
  `tdsk-backend`,
  `tdsk-proxy`,
  `tdsk-caddy`,
  `tdsk-sandbox`,
  `tdsk-embeddings`,
] as const
export type TOpsAllowedDeployment = (typeof OpsAllowedDeployments)[number]

/**
 * The only sandbox config fields the steward may patch. NEVER `secretIds`, `image`,
 * or registry auth (those live on the platform-side, hard-line off-limits).
 */
export const OpsAllowedSandboxFields = [
  `runtime`,
  `initScript`,
  `setupScript`,
  `envVars`,
  `minInstances`,
  `maxInstances`,
  `idleTimeoutMinutes`,
] as const
export type TOpsAllowedSandboxField = (typeof OpsAllowedSandboxFields)[number]

/** Hard cap on `podLogs.tailLines` to prevent log-flooding. */
export const OpsPodLogsMaxTail = 500

/** Fence label for ops-review verdicts parsed from runtime stdout. */
export const OpsReviewsBlockFence = `tdsk-ops-reviews`

/** Maximum ops-action rows injected into a prompt for review. */
export const OpsReviewInjectMax = 15

/** Maximum characters of ops-review context injected into a prompt. */
export const OpsReviewInjectMaxChars = 8000

/** Re-exported from prefixes for enum-adjacent usage. */
export { OpsActionIdPrefix as OpsIdPrefix } from '@TDM/constants/prefixes'
