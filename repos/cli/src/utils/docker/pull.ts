import type { TUtilArgs } from '@TSCL/types'

import { addTags } from '@TSCL/utils/docker/helpers'

export const pull = (props: TUtilArgs) => {
  const { ctx, params } = props
  const { tag, image } = params

  const imageName = (image || ctx.image).split(`:`).shift()
  const defaultTag = `${imageName}:${ctx.tag}`

  const tagsToAdd = tag && tag.length ? addTags(ctx, tag, image) : [defaultTag]

  return [`pull`, ...tagsToAdd]
}
