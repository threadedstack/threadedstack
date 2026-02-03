import type { TTask } from '../../types'

import { run } from './run'
import { pull } from './pull'
import { push } from './push'
import { exec } from './exec'
import { build } from './build'
import { login } from './login'

export const docker: TTask = {
  name: `docker`,
  alias: [`doc`, `dc`],
  tasks: {
    run,
    exec,
    pull,
    push,
    login,
    build,
  },
}
