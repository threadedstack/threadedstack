import type { TTask } from '../../types'

import { start } from './start'

export const web: TTask = {
  name: `web`,
  alias: [`ui`],
  tasks: {
    start,
  },
}
