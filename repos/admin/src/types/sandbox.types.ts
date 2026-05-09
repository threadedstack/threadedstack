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
