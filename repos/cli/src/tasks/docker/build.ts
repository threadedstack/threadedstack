import type { TTask, TTaskAction } from '@TSCL/types'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { docker } from '@TSCL/utils/docker/docker'
import { taskError } from '@TSCL/utils/tasks/error'
import { login } from '@TSCL/tasks/docker/login'

/**
 * Runs a docker build command and returns the output
 * @function
 * @public
 * @returns {Void}
 */
const buildImg:TTaskAction = async (args) => {
  const { params } = args
  const ctx = getCtx(args)
  !ctx && taskError(`Build context name is missing or invalid`)

  params?.login && await login.action(args)
  await docker.build({...args, ctx})
}

export const build:TTask = {
  name: `build`,
  alias: [`bld`],
  action: buildImg,
  example: `pnpm tdsk dev img build <options>`,
  description: `Calls the image build command`,
  options: {
    context: {
      required: true,
      example: `--context proxy`,
      alias: [`ctx`, `name`, `type`],
      description: `Context or name to use when resolving the Dockerfile to built`,
    },
    push: {
      type: `boolean`,
      default: false,
      description: `Push the built image to the docker provider`,
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
      description: `Log command before they are build`,
    },
    cache: {
      type: `boolean`,
      default: true,
      description: `User docker cache when building the image`,
    },
    arm: {
      type: `boolean`,
      default: false,
      description: `Sets the build platform to be arm64 only`,
    },
    platforms: {
      type: `array`,
      default: [`linux/amd64`, `linux/arm64`],
      description: `List of docker platforms to be built`,
    },
    login: {
      default: false,
      type: `boolean`,
      alias: [`auth`],
      example: `--login`,
      description: `Log into the docker registry before building the image. Typically used along side the push option`,
    },
    ...login.options,
  },
}
