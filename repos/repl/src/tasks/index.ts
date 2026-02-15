import type { TTasks } from '@TRL/types'

import { login } from './login'
import { logout } from './logout'
import { status } from './status'
import { agents } from './agents'
import { threads } from './threads'
import { chat } from './chat'
import { help } from './help'

export const tasks: TTasks = {
  chat,
  help,
  login,
  logout,
  status,
  agents,
  threads,
}
