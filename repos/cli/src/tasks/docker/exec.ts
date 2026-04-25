import type { TTask, TTaskAction } from '@TSCL/types'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { docker } from '@TSCL/utils/docker/docker'
import { taskError } from '@TSCL/utils/tasks/error'

/**
 * Runs a docker exec command on a running container
 * @function
 * @public
 * @returns {Void}
 */
const execImg: TTaskAction = async (args) => {
  const ctx = getCtx(args)
  !ctx && taskError(`Build context name is missing or invalid`)

  await docker.exec({ ...args, ctx })
}

export const exec: TTask = {
  name: `exec`,
  alias: [`ex`],
  action: execImg,
  example: `tdsk docker exec <options>`,
  description: `Execute a command on a running Docker container`,
  options: {
    context: {
      required: true,
      example: `--context proxy`,
      alias: [`ctx`, `name`, `type`],
      description: `Context or name to use when resolving the container`,
    },
    container: {
      alias: [`cnt`, `id`],
      example: `--container my-container`,
      description: `Container name or ID. If not provided, uses the context's deployment name`,
    },
    command: {
      alias: [`cmd`, `c`],
      example: `--command /bin/bash`,
      default: `/bin/sh`,
      description: `Command to run in the container. Defaults to /bin/sh for shell access`,
    },
    attach: {
      alias: [`at`, `it`],
      default: true,
      type: `boolean`,
      description: `Attach to the container (interactive mode)`,
    },
    detach: {
      alias: [`d`],
      default: false,
      type: `boolean`,
      description: `Run in detached mode`,
    },
    envs: {
      type: `object`,
      alias: [`e`],
      example: `CUSTOM_ENV:custom-value,OTHER_ENV:other-value`,
      description: `Key/Value pairs of ENVs to add to the exec process`,
    },
    workdir: {
      alias: [`w`],
      example: `--workdir /app`,
      description: `Working directory inside the container`,
    },
    user: {
      alias: [`u`],
      example: `--user root`,
      description: `User to run the command as`,
    },
    log: {
      type: `boolean`,
      description: `Log command before they are run`,
    },
  },
}
