import type { TTask } from '../../types'

import { run } from './run'
import { build } from './build'
import { login } from './login'

export const docker: TTask = {
  name: `docker`,
  alias: [`doc`, `dc`],
  tasks: {
    run,
    login,
    build,
  },
}
