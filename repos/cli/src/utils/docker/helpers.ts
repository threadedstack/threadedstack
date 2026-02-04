import type { TCtxCfg, TUtilArgs } from '@TSCL/types'

import { noOpArr } from '@keg-hub/jsutils'
import { exists } from '@keg-hub/jsutils/exists'

export const addTags = (ctx: TCtxCfg, tags: string[], image?: string) => {
  image = (image || ctx.image).split(`:`).shift()

  return tags.reduce((acc, tag) => {
    if (!tag) return acc

    const fullTag = tag.includes(`:`) ? tag : `${image}:${tag}`
    acc.push(fullTag)

    return acc
  }, noOpArr as string[])
}

export const addPorts = (props: TUtilArgs) => {
  const { ctx } = props
  const { ports } = props.params

  const args = ctx.ports ? [`-p`, `${ctx.ports.host}:${ctx.ports.remote}`] : []

  Object.entries(ports).forEach(([key, val = key]) => args.push(`-p`, `${key}:${val}`))

  return args
}

export const addEnvs = (props: TUtilArgs) => {
  const { config, params } = props

  const args = Object.entries(config.envs).reduce((acc, [key, value]) => {
    exists(value) && acc.push(`-e`, `${key}=${value}`)
    return acc
  }, [] as string[])

  Object.entries(params.envs).reduce((acc, [key, value]) => {
    exists(value) && acc.push(`-e`, `${key}=${value}`)
    return acc
  }, args)

  return args
}
