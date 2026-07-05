import type {
  EOpsAction,
  TOpsAllowedDeployment,
  TOpsAllowedSandboxField,
} from '@TDM/constants/ops'

/** Discriminated input union — one payload shape per action. */
export type TOpsActionInput =
  | {
      action: EOpsAction.podStatus
      params: { component?: TOpsAllowedDeployment; podName?: string }
    }
  | {
      action: EOpsAction.podLogs
      params: {
        component?: TOpsAllowedDeployment
        podName?: string
        tailLines?: number
        previous?: boolean
      }
    }
  | { action: EOpsAction.deployState; params: { deployment?: TOpsAllowedDeployment } } // omit = all allowlisted
  | { action: EOpsAction.quotaUsage; params: {} }
  | { action: EOpsAction.triggerRedeploy; params: { forceAll?: boolean; reason: string } }
  | {
      action: EOpsAction.restartDeployment
      params: { deployment: TOpsAllowedDeployment; reason: string }
    }
  | {
      action: EOpsAction.applySandboxConfig
      params: {
        sandboxId: string
        patch: Partial<Record<TOpsAllowedSandboxField, any>>
        reason: string
      }
    }

export type TOpsActionResult = {
  ok: boolean
  data?: any
  error?: string
  startedAt?: string
  completedAt?: string
}
export type TOpsScanResult = { passed: boolean; findings: string[] }

/** Rollback data captured at dry-run time; kind is discriminated by which action created it. */
export type TOpsRollback =
  | { kind: `restart`; prevRevision: string | null }
  | { kind: `redeploy`; prevSha: string | null }
  | { kind: `sandboxConfig`; prevConfig: Record<string, any> }

export enum EOpsActionStatus {
  proposed = `proposed`,
  dryRun = `dryRun`,
  rejected = `rejected`, // scan failed OR adversary rejected OR admin overrode reject
  executed = `executed`,
  failed = `failed`, // execution attempted but errored (rollback exercised)
}
export type TOpsActionStatus = `${EOpsActionStatus}`

/** Full ops-action row shape. */
export type TOpsActionRow = {
  id: string
  orgId: string
  agentId: string
  action: EOpsAction
  params: TOpsActionInput['params']
  dryRun: boolean
  dryRunResult: TOpsActionResult | null
  result: TOpsActionResult | null
  status: TOpsActionStatus
  scanResult: TOpsScanResult | null
  reviewVerdict: { approved: boolean; reason: string; by?: string } | null
  rollback: TOpsRollback | null
  reason: string | null
  meta: Record<string, any> | null
  createdAt?: string | Date
  updatedAt?: string | Date
}
