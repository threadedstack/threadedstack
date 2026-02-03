import type { TCtxCfg, TTaskActionArgs } from '@TSCL/types'

import { addTags } from '@TSCL/utils/docker/helpers'

export type TPullCmd = TTaskActionArgs & {
  ctx: TCtxCfg
  env?: Record<string, string>
}

export const pull = (props: TPullCmd) => {
  const { ctx, params } = props
  const { tag, image } = params

  const imageName = (image || ctx.image).split(`:`).shift()
  const defaultTag = `${imageName}:${ctx.tag}`

  const tagsToAdd = tag && tag.length ? addTags(ctx, tag, image) : [defaultTag]

  return [`pull`, ...tagsToAdd]
}
