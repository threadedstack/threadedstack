import { isObj } from '@keg-hub/jsutils/isObj'
import { objToQuery } from '@keg-hub/jsutils/objToQuery'


export const toQueryParams = (data:Record<string, string|number>) => {
  return !isObj(data) ? `` : objToQuery(data)
}

