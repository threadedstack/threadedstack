import type { TTask, TTaskAction } from '@TSCL/types'
import { kubectl } from '@TSCL/utils/kube/kubectl'

/**
 * Sets the active kubernetes context
 * @function
 * @public
 * @returns {Void}
 */
const setAction: TTaskAction = async (args) => {
  const { params } = args
  const { context } = params
  !context && console.error(`Context is required`)

  await kubectl.useContext(args, context)
}

export const set: TTask = {
  name: `set`,
  alias: [`use`],
  action: setAction,
  example: `pnpm tdsk kube set <options>`,
  description: `Sets the active kubernetes context`,
  options: {
    context: {
      required: true,
      alias: [`ctx`, `name`],
      example: `--context my-context`,
      description: `Context name to set as active`,
    },
    log: {
      type: `boolean`,
      description: `Log command before it is run`,
    },
  },
}
