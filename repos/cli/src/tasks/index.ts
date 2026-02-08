import type { TTasks } from '@TSCL/types'

import * as web from './web'
import * as kube from './kube'
import * as docker from './docker'
import * as devspace from './devspace'

export const tasks: TTasks = {
  ...kube,
  ...web,
  ...docker,
  ...devspace,
}
