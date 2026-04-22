import type { TTask } from '@TSCL/types'

import { set } from './set'
import { pod } from './pod'
import { logs } from './logs'
import { remove } from './remove'
import { secret } from './secret'
import { namespace } from './namespace'

export const kube: TTask = {
  name: `kube`,
  alias: [`kubectl`, `kb`, `kcl`],
  example: `pnpm tdsk kube <options>`,
  description: `Runs kubectl commands with the current context`,
  tasks: {
    set,
    pod,
    logs,
    secret,
    remove,
    namespace,
  },
}
