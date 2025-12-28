import type { TTask, TTaskAction } from '@TSCL/types'

import { run } from '@TSCL/tasks/docker/run'
import { pnpm } from '@TSCL/utils/pnpm/pnpm'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { deepMerge } from '@keg-hub/jsutils/deepMerge'


const repoStart:TTaskAction = async (args) => {
  const { params } = args
  if(params.docker) return await run?.action(args)
  
  const ctx = getCtx(args)

  await pnpm.run(deepMerge(args, {
    params: {
      cmd: `start`,
      cwd: ctx.location,
    }
  }))
}

export const start:TTask = {
  name: `start`,
  alias: [`st`],
  action: repoStart,
  example: `pnpm tdsk dev img build <options>`,
  description: `Calls the image build command`,
  options: {
    context: {
      required: true,
      example: `--context proxy`,
      alias: [`ctx`, `name`, `type`],
      description: `Context or name of the repo to start`,
    },
    args: {
      default: [],
      type: `array`,
      description: `Extra arguments to pass to the repos start command`,
    },
    docker: {
      default: false,
      type: `boolean`,
      description: `Start the application in a docker container`,
    },
    ...run.options
  },
}
