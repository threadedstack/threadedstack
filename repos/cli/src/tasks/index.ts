import type { TTasks } from '@TSCL/types'
import * as kube from './kube'
import * as repos from './repos'
import * as docker from './docker'

import * as devspace from './devspace'

export const tasks: TTasks = {
  ...kube,
  ...repos,
  ...docker,
  ...devspace,
}
