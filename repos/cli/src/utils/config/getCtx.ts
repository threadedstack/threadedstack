import type { TTaskActionArgs } from '@TSCL/types'

import fs from 'node:fs'
import { ECtxMap } from '@TSCL/types'
import { taskError } from '@TSCL/utils/tasks/error'

export const getCtx = (args: TTaskActionArgs) => {
  const { config, params } = args

  const { tag, image, context, type } = params
  const ctxName = ECtxMap[context] || context
  const found = config.contexts?.[ctxName]

  !found &&
    taskError(
      [
        `Invalid context: "${context}". Available contexts:`,
        Object.keys(config.contexts || {}).join(`, `),
      ].join(` `)
    )

  found.location &&
    !fs.existsSync(found.location) &&
    taskError(
      [
        `Repository directory does not exist: ${found.location}\n`,
        `Please ensure the repository has been cloned.`,
      ].join(` `)
    )

  const ctx = { ...found }

  if (ctxName === ECtxMap.sandbox && type && type !== `base`)
    ctx.image = ctx.image.replace(/-base$/, `-${type}`)

  if (image) ctx.image = image
  if (tag?.length) ctx.tags = tag

  return ctx
}
