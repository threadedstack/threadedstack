import type { TCtxCfg, TTaskActionArgs } from '@TSCL/types'

import { addTags } from '@TSCL/utils/docker/helpers'

export type TPushCmd = TTaskActionArgs & {
  ctx: TCtxCfg
  env?: Record<string, string>
}

export const push = (props: TPushCmd) => {
  const { ctx, params } = props
  const { tag, image } = params

  const imageName = (image || ctx.image).split(`:`).shift()
  const defaultTag = `${imageName}:${ctx.tag}`

  const tagsToPush = tag && tag.length ? addTags(ctx, tag, image) : [defaultTag]

  return [`push`, ...tagsToPush]
}
