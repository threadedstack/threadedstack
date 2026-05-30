import type { TTasks } from '@TSA/types'

import { ssh } from './ssh'
import { sync } from './sync'
import { chat } from './chat'
import { help } from './help'
import { login } from './login'
import { proxy } from './proxy'
import { ports } from './ports'
import { logout } from './logout'
import { status } from './status'
import { agents } from './agents'
import { sandbox } from './sandbox'
import { threads } from './threads'
import { sessions } from './sessions'
import { AgentsEnabled } from '@TSA/constants/values'

export const tasks: TTasks = {
  ssh,
  sync,
  help,
  login,
  proxy,
  ports,
  logout,
  status,
  sandbox,
  sessions,
  ...(AgentsEnabled ? { agents, threads, chat } : {}),
}
