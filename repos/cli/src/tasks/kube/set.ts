import type { TTask, TTaskAction } from '@TSCL/types'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { taskError } from '@TSCL/utils/tasks/error'

const action: TTaskAction = async (args) => {
  const { params } = args
  console.log(`TODO - Not implemented`)
}

export const set: TTask = {
  name: `set`,
  alias: [`use`],
  action: action,
  example: `pnpm tdsk kube set <options>`,
  description: ``,
  options: {},
}
