import type { TTasks } from '@TSA/types'

import { run } from './run'
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
import { sandboxes } from './sandboxes'

export const tasks: TTasks = {
  run,
  ssh,
  sync,
  chat,
  help,
  login,
  proxy,
  logout,
  status,
  agents,
  threads,
  sandboxes,
}
