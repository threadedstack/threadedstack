import type { TTasks } from '@TSCL/types'

import * as db from './db'
import * as web from './web'
import * as kube from './kube'
import * as docker from './docker'
import * as deploy from './deploy'
import * as devspace from './devspace'

export const tasks: TTasks = {
  ...db,
  ...kube,
  ...web,
  ...docker,
  ...deploy,
  ...devspace,
}
