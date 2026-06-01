import type { TTask } from '@TSA/types'

import { addTask } from '@TSA/tasks/ports/add'
import { listTask } from '@TSA/tasks/ports/list'
import { openTask } from '@TSA/tasks/ports/open'
import { removeTask } from '@TSA/tasks/ports/remove'
import { SandboxOptions, InstanceOptions } from '@TSA/constants/options'

export const ports: TTask = {
  name: `ports`,
  alias: [`port`, `po`],
  description: `Manage exposed ports on a sandbox instance`,
  example: `tsa ports [<sandbox>] [--org <id>] [--project <id>]`,
  options: { ...SandboxOptions, ...InstanceOptions },
  tasks: {
    add: addTask,
    open: openTask,
    list: listTask,
    remove: removeTask,
  },
  action: async (ctx) => {
    const list = ports.tasks?.list?.action
    if (list) await list(ctx)
  },
}
