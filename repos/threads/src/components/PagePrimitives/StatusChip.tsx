import { Chip } from '@tdsk/components'
import type { TChipTone } from '@tdsk/components'
import type { TSandboxStatus, TStatusChip } from '@TTH/types'

const StatusToneMap: Record<TSandboxStatus, TChipTone> = {
  idle: `neutral`,
  failed: `error`,
  closed: `neutral`,
  running: `success`,
  active: `success`,
  pending: `warning`,
  stopped: `neutral`,
  building: `warning`,
}

const PulseStatuses = new Set<TSandboxStatus>([`running`, `active`])

export const StatusChip = (props: TStatusChip) => {
  const { status, size = `md` } = props
  const tone = StatusToneMap[status] ?? `neutral`
  const label = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <Chip
      tone={tone}
      size={size}
      variant='tint'
      label={label}
      pulse={PulseStatuses.has(status)}
    />
  )
}
