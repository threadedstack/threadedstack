import type { TTaskActionArgs } from '@TSCL/types'
import { ECtxMap } from '@TSCL/types'

export const getCtx = (args: TTaskActionArgs) => {
  const { config, params } = args

  const { tag, image, context } = params
  const found = config.contexts?.[ECtxMap[context]] || config.contexts?.[context]
  if (!found) return

  if (image) found.image = image
  if (tag?.length) found.tags = tag

  return found
}
