import type { TTask, TTaskAction } from '@TSCL/types'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { docker } from '@TSCL/utils/docker/docker'
import { taskError } from '@TSCL/utils/tasks/error'
import { login } from '@TSCL/tasks/docker/login'

/**
 * Runs a docker pull command and returns the output
 * @function
 * @public
 * @returns {Void}
 */
const pullImg: TTaskAction = async (args) => {
  const { params } = args
  const ctx = getCtx(args)
  !ctx && taskError(`Build context name is missing or invalid`)

  params?.login && (await login.action(args))
  await docker.pull({ ...args, ctx })
}

export const pull: TTask = {
  name: `pull`,
  alias: [`pl`],
  action: pullImg,
  example: `tdsk dev img pull <options>`,
  description: `Calls the image pull command`,
  options: {
    context: {
      required: true,
      example: `--context proxy`,
      alias: [`ctx`, `name`, `type`],
      description: `Context or name to use when resolving the Dockerfile to built`,
    },
    tag: {
      type: `array`,
      alias: [`tags`],
      default: [],
      example: `--tag my-tag,other-tag`,
      description: `Name of the tag to add to the built Docker image`,
    },
    image: {
      alias: [`img`],
      example: `--image image-name`,
      description: `Name of the docker image to be built. Used when tagging`,
    },
    log: {
      type: `boolean`,
      description: `Log command before they are pull`,
    },
    login: {
      default: false,
      type: `boolean`,
      alias: [`auth`],
      example: `--login`,
      description: `Log into the docker registry before pulling the image. Typically used along side the push option`,
    },
    ...login.options,
  },
}
