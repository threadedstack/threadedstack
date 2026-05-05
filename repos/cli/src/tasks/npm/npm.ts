import type { TTask } from '@TSCL/types'

import { pack } from './pack'
import { publish } from './publish'

export const npm: TTask = {
  name: `npm`,
  alias: [`pkg`],
  tasks: {
    pack,
    publish,
  },
}
