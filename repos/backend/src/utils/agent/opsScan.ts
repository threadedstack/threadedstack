import type { TDatabase } from '@tdsk/database'
import type { TOpsActionInput, TOpsScanResult } from '@tdsk/domain'

import {
  EOpsAction,
  OpsAllowedDeployments,
  OpsAllowedSandboxFields,
  OpsPodLogsMaxTail,
} from '@tdsk/domain'

import { scanText } from './textScan'

/** ctx supplies the DB so applySandboxConfig can verify org-ownership of sandboxId. */
export type TOpsScanCtx = { db: TDatabase; orgId: string }

/**
 * Deterministic allowlist gate for an ops action payload. Fail-closed: any structural
 * mismatch, any unknown value, or any injection/exfil/destructive pattern in a free-text
 * field returns passed:false with concrete findings. NEVER approves an out-of-allowlist
 * deployment, an oversized log tail, or a sandbox patch that touches secretIds/image/etc.
 */
export const scanOpsAction = async (
  input: TOpsActionInput,
  ctx: TOpsScanCtx
): Promise<TOpsScanResult> => {
  const findings: string[] = []

  // 1. Enum gate — fail-closed for anything not in EOpsAction.
  if (!Object.values(EOpsAction).includes(input.action as EOpsAction)) {
    findings.push(`[unknown-action] '${input.action}' not in EOpsAction allowlist`)
    return { passed: false, findings }
  }

  // 2. Per-action structural + allowlist checks.
  const p = (input as any).params ?? {}

  switch (input.action) {
    case EOpsAction.podStatus:
    case EOpsAction.podLogs: {
      if (
        p.component !== undefined &&
        !(OpsAllowedDeployments as readonly string[]).includes(p.component)
      )
        findings.push(
          `[deploy-allowlist] component '${p.component}' not in OpsAllowedDeployments`
        )

      if (input.action === EOpsAction.podLogs) {
        const tail = p.tailLines
        if (tail !== undefined) {
          if (!Number.isInteger(tail) || tail <= 0)
            findings.push(`[params] podLogs.tailLines must be a positive integer`)
          else if (tail > OpsPodLogsMaxTail)
            findings.push(
              `[params] podLogs.tailLines ${tail} exceeds cap ${OpsPodLogsMaxTail}`
            )
        }
      }
      break
    }

    case EOpsAction.deployState: {
      if (
        p.deployment !== undefined &&
        !(OpsAllowedDeployments as readonly string[]).includes(p.deployment)
      )
        findings.push(
          `[deploy-allowlist] deployment '${p.deployment}' not in OpsAllowedDeployments`
        )
      break
    }

    case EOpsAction.quotaUsage: {
      // No params to validate.
      break
    }

    case EOpsAction.restartDeployment: {
      if (!(OpsAllowedDeployments as readonly string[]).includes(p.deployment))
        findings.push(
          `[deploy-allowlist] deployment '${p.deployment}' not in OpsAllowedDeployments`
        )

      if (typeof p.reason !== `string` || !p.reason.trim())
        findings.push(`[params] restartDeployment.reason is required`)
      else {
        const scan = scanText(p.reason)
        if (!scan.passed) findings.push(...scan.findings.map((f) => `[reason] ${f}`))
      }
      break
    }

    case EOpsAction.triggerRedeploy: {
      if (typeof p.reason !== `string` || !p.reason.trim())
        findings.push(`[params] triggerRedeploy.reason is required`)
      else {
        const scan = scanText(p.reason)
        if (!scan.passed) findings.push(...scan.findings.map((f) => `[reason] ${f}`))
      }
      break
    }

    case EOpsAction.applySandboxConfig: {
      const { sandboxId, patch, reason } = p

      if (typeof sandboxId !== `string` || !sandboxId)
        findings.push(`[params] applySandboxConfig.sandboxId is required`)

      if (typeof reason !== `string` || !reason.trim())
        findings.push(`[params] applySandboxConfig.reason is required`)
      else {
        const scan = scanText(reason)
        if (!scan.passed) findings.push(...scan.findings.map((f) => `[reason] ${f}`))
      }

      if (!patch || typeof patch !== `object` || Array.isArray(patch))
        findings.push(`[params] applySandboxConfig.patch must be an object`)
      else {
        // Every key must be in the allowlist; NEVER secretIds/image/registry auth.
        for (const key of Object.keys(patch)) {
          if (!(OpsAllowedSandboxFields as readonly string[]).includes(key))
            findings.push(
              `[patch-allowlist] key '${key}' is not in OpsAllowedSandboxFields`
            )
        }

        // envVars: scan each key=value for injection/exfil, plus explicit secret-word guard.
        if (patch.envVars && typeof patch.envVars === `object`) {
          for (const [k, v] of Object.entries(patch.envVars as Record<string, unknown>)) {
            const s = typeof v === `string` ? v : JSON.stringify(v)
            const scan = scanText(`${k}=${s}`)
            if (!scan.passed)
              findings.push(...scan.findings.map((f) => `[envVars.${k}] ${f}`))

            // Reject env names/values that look like tokens or keys — secrets live server-side.
            if (
              /[_-](TOKEN|SECRET|KEY|PASSWORD|AUTH)$/i.test(k) ||
              /^(sk|pk|Bearer)\s/i.test(String(v))
            )
              findings.push(
                `[envVars.${k}] name/value looks like a secret; secrets live server-side, not in envVars`
              )
          }
        }

        // Ownership check: sandbox must belong to ctx.orgId.
        if (typeof sandboxId === `string` && sandboxId) {
          try {
            const { data: sandbox } = await ctx.db.services.sandbox.get(sandboxId)
            if (!sandbox) findings.push(`[ownership] sandbox '${sandboxId}' not found`)
            else if ((sandbox as any).orgId !== ctx.orgId)
              findings.push(
                `[ownership] sandbox '${sandboxId}' belongs to a different org`
              )
          } catch (e) {
            findings.push(
              `[ownership] failed to verify sandbox ownership: ${(e as Error).message}`
            )
          }
        }
      }
      break
    }

    default: {
      // Exhaustiveness guard — fail closed.
      findings.push(`[unreachable] action ${(input as any).action} not handled`)
    }
  }

  return { passed: findings.length === 0, findings }
}
