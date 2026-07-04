import type { TCtxCfg, TUtilArgs } from '@TSCL/types'

import { join } from 'node:path'
import { emptyArr } from '@keg-hub/jsutils/emptyArr'

const addPlatforms = (platforms: string[] = emptyArr, push?: boolean) => {
  return platforms.length && push ? [`--platform`, platforms.join(`,`)] : emptyArr
}

const addTags = (ctx: TCtxCfg, tags: string[] = [], image?: string) => {
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

/**
 * Adds a registry-backed buildx cache so fresh CI runners reuse layers across
 * builds (e.g. the backend's `isolated-vm` node-gyp rebuild). The cache ref is
 * derived from the same image base used for tagging, with a `:buildcache` tag.
 *
 * Only emitted on the push/buildx path — `--cache-to type=registry` requires
 * the buildx container driver and errors on plain `--load` local builds. The
 * caller can disable it by passing `cache: false`.
 */
const addCache = (ctx: TCtxCfg, push?: boolean, cache?: boolean, image?: string) => {
  if (!push || cache === false) return emptyArr

  const base = (image || ctx.image).split(`:`).shift()
  const ref = `${base}:buildcache`

  return [
    `--cache-from`,
    `type=registry,ref=${ref}`,
    `--cache-to`,
    `type=registry,ref=${ref},mode=max`,
  ]
}

export const build = (props: TUtilArgs) => {
  const { ctx, config, params } = props

  const { arm, tag, push, image, cache, platforms } = params

  const args = !push
    ? [`build`, `--load`]
    : [`build`, `--push`, ...addPlatforms(arm ? [`linux/arm64`] : platforms, push)]

  return args.concat([
    ...addCache(ctx, push, cache, image),
    ...addTags(ctx, tag, image),
    `-f`,
    join(config.paths.deploy, ctx.dockerfile),
    `.`,
  ])
}
