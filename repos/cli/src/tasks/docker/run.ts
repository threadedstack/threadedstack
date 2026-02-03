import type { TTask, TTaskAction } from '@TSCL/types'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { docker } from '@TSCL/utils/docker/docker'
import { taskError } from '@TSCL/utils/tasks/error'

/**
 * Runs a docker run command and returns the output
 * @function
 * @public
 * @returns {Void}
 */
const runImg: TTaskAction = async (args) => {
  const { params } = args
  const ctx = getCtx(args)
  !ctx && taskError(`Build context name is missing or invalid`)

  // TODO: Check pull param, and pull the image before running if set
  await docker.run({ ...args, ctx })
}

export const run: TTask = {
  name: `run`,
  alias: [`start`],
  action: runImg,
  example: `pnpm tdsk dev img run <options>`,
  description: `Calls the image run command`,
  options: {
    context: {
      required: true,
      example: `--context proxy`,
      alias: [`ctx`, `name`, `type`],
      description: `Context or name to use when resolving the Dockerfile to built`,
    },
    pull: {
      type: `boolean`,
      default: false,
      description: `Pull the image before running it`,
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
    envs: {
      type: `object`,
      alias: [`e`],
      example: `CUSTOM_ENV:custom-value,OTHER_ENV:other-value`,
      description: `Key/Value pairs of ENVs to add to the docker process`,
    },
    name: {
      alias: [`n`],
      description: `Custom name for the container, defaults to image name`,
    },
    remove: {
      alias: [`rm`],
      default: true,
      type: `boolean`,
      description: `Automatically remove the container once stopped`,
    },
    attach: {
      alias: [`at`, `it`],
      default: true,
      type: `boolean`,
      description: `Attach to the container`,
    },
    privileged: {
      alias: [`prv`],
      default: false,
      type: `boolean`,
      description: `Run the container in privileged mode`,
    },
    log: {
      type: `boolean`,
      description: `Log command before they are run`,
    },
  },
}
