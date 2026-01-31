import type { TTaskActionArgs } from '@TSCL/types'

import fs from 'node:fs'
import { ECtxMap } from '@TSCL/types'
import { taskError } from '@TSCL/utils/tasks/error'

export const getCtx = (args: TTaskActionArgs) => {
  const { config, params } = args

  const { tag, image, context } = params
  const found = config.contexts?.[ECtxMap[context]] || config.contexts?.[context]

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

  if (image) found.image = image
  if (tag?.length) found.tags = tag

  return found
}
