import type { TTask } from '../../types'

import { set } from './set'
import { remove } from './remove'
import { secret } from './secret'
import { ingress } from './ingress'
import { namespace } from './namespace'

export const kube:TTask = {
  name: `kube`,
  alias: [ `kubectl`, `kb`, `kcl` ],
  tasks: {
    set,
    secret,
    remove,
    ingress,
    namespace,
  },
}
