import type { TTasks } from '@TSCL/types'

import * as db from './db'
import * as npm from './npm'
import * as web from './web'
import * as kube from './kube'
import * as docker from './docker'
import * as deploy from './deploy'
import * as stripe from './stripe'
import * as devspace from './devspace'

export const tasks: TTasks = {
  ...db,
  ...npm,
  ...kube,
  ...web,
  ...docker,
  ...deploy,
  ...stripe,
  ...devspace,
}
