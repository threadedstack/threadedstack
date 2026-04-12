import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getSandbox } from '@TBE/endpoints/sandboxes/getSandbox'
import { copySandbox } from '@TBE/endpoints/sandboxes/copySandbox'
import { listSandboxes } from '@TBE/endpoints/sandboxes/listSandboxes'
import { createSandbox } from '@TBE/endpoints/sandboxes/createSandbox'
import { updateSandbox } from '@TBE/endpoints/sandboxes/updateSandbox'
import { deleteSandbox } from '@TBE/endpoints/sandboxes/deleteSandbox'

export const sandboxes: TEndpointConfig = {
  path: `/sandboxes`,
  method: EPMethod.Use,
  endpoints: {
    listSandboxes,
    createSandbox,
    copySandbox,
    getSandbox,
    updateSandbox,
    deleteSandbox,
  },
}
