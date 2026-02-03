import type { TCtxCfg } from '@TSCL/types'

import { noOpArr } from '@keg-hub/jsutils'

export const addTags = (ctx: TCtxCfg, tags: string[], image?: string) => {
  image = (image || ctx.image).split(`:`).shift()

  return tags.reduce((acc, tag) => {
    if (!tag) return acc

    const fullTag = tag.includes(`:`) ? tag : `${image}:${tag}`
    acc.push(fullTag)

    return acc
  }, noOpArr as string[])
}
