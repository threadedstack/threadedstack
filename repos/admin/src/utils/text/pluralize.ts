import { plural } from '@keg-hub/jsutils/plural'

const ESPlural = [`s`, `x`, `ch`, `sh`]

export const pluralize = (count: number, singular: string): string => {
  if (count === 1) return singular

  if (ESPlural.some((end) => singular.endsWith(end))) return `${singular}es`

  if (singular.endsWith('y') && !/[aeiou]y$/i.test(singular))
    return `${singular.slice(0, -1)}ies`

  return plural(singular)
}
