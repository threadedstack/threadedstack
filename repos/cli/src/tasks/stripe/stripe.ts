import type { TTask } from '../../types'

import { forward } from './forward'

export const stripe: TTask = {
  name: `stripe`,
  alias: [`st`],
  tasks: {
    forward,
  },
}
