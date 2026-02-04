import type { TUtilArgs } from '@TSCL/types'

export type TDockerExecArgs = {
  container?: string
  command: string
  attach: boolean
  detach: boolean
  workdir?: string
  user?: string
}

/**
 * Builds the docker exec command arguments
 */
const getExecArgs = ({ attach, detach, workdir, user }: TDockerExecArgs) => {
  const args = []

  attach && !detach && args.push(`-it`)
  detach && args.push(`-d`)
  workdir && args.push(`--workdir`, workdir)
  user && args.push(`--user`, user)

  return args
}

/**
 * Builds the docker exec command
 */
export const exec = (props: TUtilArgs) => {
  const { ctx, params } = props

  const container = params.container || ctx.deployment
  const command = params.command || `/bin/sh`

  const args = getExecArgs(params as TDockerExecArgs)

  return [`exec`, ...args, container, command]
}
