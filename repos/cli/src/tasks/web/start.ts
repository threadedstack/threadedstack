import type { TTask, TTaskAction } from '@TSCL/types'

import { pnpm } from '@TSCL/utils/pnpm/pnpm'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { deepMerge } from '@keg-hub/jsutils/deepMerge'

const webStart: TTaskAction = async (args) => {
  const ctx = getCtx(args)

  await pnpm.run(
    deepMerge(args, {
      params: {
        cmd: `start`,
        cwd: ctx.location,
      },
    })
  )
}

export const start: TTask = {
  name: `start`,
  alias: [`st`],
  action: webStart,
  example: `tdsk web <options>`,
  description: `Calls web UI related tasks`,
  options: {
    context: {
      required: false,
      default: `admin`,
      alias: [`ctx`, `name`, `type`],
      description: `Context or name of the web UI repo to start`,
    },
    args: {
      default: [],
      type: `array`,
      description: `Extra arguments to pass to the repos start command`,
    },
  },
}
