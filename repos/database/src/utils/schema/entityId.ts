import type { TEntityPrefix } from '@tdsk/domain'

import { nanoid, customAlphabet } from 'nanoid'
import { varchar } from 'drizzle-orm/pg-core'
import { IdLength } from '@TDB/constants/schema'

export const entityId = (prefix: TEntityPrefix, alphabet?: string) => {
  const randomLength = IdLength - prefix.length
  if (randomLength <= 0)
    throw new Error(`Prefix "${prefix}" is too long for IdLength ${IdLength}`)

  const generate = alphabet
    ? customAlphabet(alphabet, randomLength)
    : () => nanoid(randomLength)

  return varchar(`id`, { length: IdLength })
    .notNull()
    .primaryKey()
    .$defaultFn(() => `${prefix}${generate()}`)
}
