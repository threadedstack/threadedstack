import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getSandbox } from '@TBE/endpoints/sandboxes/getSandbox'
import { stopSandbox } from '@TBE/endpoints/sandboxes/stopSandbox'
import { startSandbox } from '@TBE/endpoints/sandboxes/startSandbox'
import { listSandboxes } from '@TBE/endpoints/sandboxes/listSandboxes'
import { execInSandbox } from '@TBE/endpoints/sandboxes/execInSandbox'
import { createSandbox } from '@TBE/endpoints/sandboxes/createSandbox'
import { updateSandbox } from '@TBE/endpoints/sandboxes/updateSandbox'
import { deleteSandbox } from '@TBE/endpoints/sandboxes/deleteSandbox'
import { getSandboxStatus } from '@TBE/endpoints/sandboxes/getSandboxStatus'

export const sandboxes: TEndpointConfig = {
  path: `/sandboxes`,
  method: EPMethod.Use,
  endpoints: {
    getSandbox,
    stopSandbox,
    startSandbox,
    listSandboxes,
    execInSandbox,
    createSandbox,
    updateSandbox,
    deleteSandbox,
    getSandboxStatus,
  },
}
