import type { TTask } from '../../types'

import { log } from './log'
import { use } from './use'
import { start } from './start'
import { clean } from './clean'
import { enter } from './enter'
import { attach } from './attach'
import { render } from './render'

export const devspace: TTask = {
  name: `devspace`,
  alias: [`dev`, `ds`],
  tasks: {
    use,
    log,
    start,
    enter,
    clean,
    render,
    attach,
  },
}
