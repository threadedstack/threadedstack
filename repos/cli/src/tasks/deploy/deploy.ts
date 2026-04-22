import type { TTask } from '@TSCL/types'

import { apply } from './apply'
import { status } from './status'

export const deploy: TTask = {
  name: `deploy`,
  alias: [`dp`],
  tasks: {
    apply,
    status,
  },
}
