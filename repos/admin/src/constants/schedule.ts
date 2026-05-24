import type { TSandboxSchedule } from '@TAF/types'

import { EScheduleType } from '@tdsk/domain'

export const DefaultTemp: TSandboxSchedule = {
  enabled: true,
  type: EScheduleType.prompt,
  cronExpression: `0 0 * * 6`,
}
