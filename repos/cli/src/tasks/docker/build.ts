import type { TTask, TTaskAction } from '@TSCL/types'
import { Logger } from '@tdsk/logger'
import { login } from '@TSCL/tasks/docker/login'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { docker } from '@TSCL/utils/docker/docker'
import { taskError } from '@TSCL/utils/tasks/error'

const buildImg: TTaskAction = async (args) => {
  const { params } = args
  const context = params?.context
  !context && taskError(`Build context name is missing or invalid`)

  const contexts = context
    .split(`,`)
    .map((c: string) => c.trim())
    .filter(Boolean)
  !contexts.length && taskError(`Build context name is missing or invalid`)

  params?.login && (await login.action(args))

  for (const name of contexts) {
    Logger.pair(`  Building`, name)
    const ctx = getCtx({ ...args, params: { ...params, context: name } })
    await docker.build({ ...args, ctx })
  }
}

export const build: TTask = {
  name: `build`,
  alias: [`bld`],
  action: buildImg,
  example: `tdsk dev img build <options>`,
  description: `Calls the image build command`,
  options: {
    context: {
      required: true,
      alias: [`ctx`, `name`],
      example: `--context app,sandbox,caddy`,
      description: `Comma-separated context names to build (e.g. app,sandbox,caddy)`,
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
    type: {
      example: `--type claude`,
      description: `Sandbox image variant (e.g. claude, codex, opencode). Only applies to --context sandbox. Defaults to base.`,
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
