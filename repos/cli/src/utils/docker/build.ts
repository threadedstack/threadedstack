import type { TCtxCfg, TTaskActionArgs } from '@TSCL/types'

import { join } from 'node:path'
import { emptyArr } from '@keg-hub/jsutils/emptyArr'

export type TBuildCmd = TTaskActionArgs & {
  ctx: TCtxCfg
  env?: Record<string, string>
}

const addPlatforms = (platforms: string[] = emptyArr, push?: boolean) => {
  return platforms.length && push ? [`--platform`, platforms.join(`,`)] : emptyArr
}

const addTags = (ctx: TCtxCfg, tags: string[], image?: string) => {
  image = (image || ctx.image).split(`:`).shift()

  return tags.reduce(
    (acc, tag) => {
      if (!tag) return acc

      tag.includes(`:`) ? acc.push(`-t`, tag) : acc.push(`-t`, `${image}:${tag}`)

      return acc
    },
    [`-t`, `${image}:${ctx.tag}`]
  )
}

export const build = (props: TBuildCmd) => {
  const { ctx, config, params } = props

  const { arm, tag, push, image, platforms } = params

  const args = !push
    ? [`build`, `--load`]
    : [`build`, `--push`, ...addPlatforms(arm ? [`linux/arm64`] : platforms, push)]

  return args.concat([
    ...addTags(ctx, tag, image),
    `-f`,
    join(config.paths.deploy, ctx.dockerfile),
    `.`,
  ])
}
