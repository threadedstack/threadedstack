import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getFunction } from '@TBE/endpoints/functions/getFunction'
import { listFunctions } from '@TBE/endpoints/functions/listFunctions'
import { createFunction } from '@TBE/endpoints/functions/createFunction'
import { updateFunction } from '@TBE/endpoints/functions/updateFunction'
import { deleteFunction } from '@TBE/endpoints/functions/deleteFunction'
import { invokeFunction } from '@TBE/endpoints/functions/invokeFunction'

export const functions: TEndpointConfig = {
  path: `/functions`,
  method: EPMethod.Use,
  endpoints: {
    listFunctions,
    getFunction,
    createFunction,
    updateFunction,
    deleteFunction,
    invokeFunction,
  },
}
