import type { Sandbox } from '@tdsk/domain'

export type TSandboxDrawer = {
  open: boolean
  orgId: string
  projectId?: string
  onClose: () => void
  onSuccess?: () => void
  sandbox?: Sandbox | null
  onRemove?: (sandbox: Sandbox) => void
}

export type TRunStatusCfg = {
  label: string
  color: `success` | `error` | `info` | `warning`
}

export type TSandboxSchedule = {
  type?: string
  prompt?: string
  command?: string
  sandboxId?: string
  enabled?: boolean
  cronExpression?: string
}
