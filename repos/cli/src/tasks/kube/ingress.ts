import type { TTask, TTaskAction } from '@TSCL/types'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { taskError } from '@TSCL/utils/tasks/error'

const action: TTaskAction = async (args) => {
  const { params } = args
  console.log(`TODO - Not implemented`)
}

export const ingress: TTask = {
  name: `ingress`,
  alias: [`ing`, `in`],
  action: action,
  example: `pnpm tdsk kube ingress <options>`,
  description: `Creates an kubernetes ingress in the active namespace`,
  options: {},
}
