import type { TTasks } from '@TSA/types'

import { ssh } from './ssh'
import { sync } from './sync'
import { chat } from './chat'
import { help } from './help'
import { login } from './login'
import { proxy } from './proxy'
import { logout } from './logout'
import { status } from './status'
import { agents } from './agents'
import { threads } from './threads'
import { ports } from './ports/ports'
import { sandbox } from './sandbox/sandbox'
import { sessions } from './sessions/sessions'
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
