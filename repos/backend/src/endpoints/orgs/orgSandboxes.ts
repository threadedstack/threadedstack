import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getSandbox } from '@TBE/endpoints/sandboxes/getSandbox'
import { copySandbox } from '@TBE/endpoints/sandboxes/copySandbox'
import { monitorToken } from '@TBE/endpoints/sandboxes/monitorToken'
import { listSandboxes } from '@TBE/endpoints/sandboxes/listSandboxes'
import { createSandbox } from '@TBE/endpoints/sandboxes/createSandbox'
import { updateSandbox } from '@TBE/endpoints/sandboxes/updateSandbox'
import { deleteSandbox } from '@TBE/endpoints/sandboxes/deleteSandbox'
import { listSandboxSessions } from '@TBE/endpoints/sandboxes/listSandboxSessions'
import { getSandboxSessionOutput } from '@TBE/endpoints/sandboxes/getSandboxSessionOutput'

export const orgSandboxes: TEndpointConfig = {
  path: `/:orgId/sandboxes`,
  method: EPMethod.Use,
  endpoints: {
    listSandboxes,
    getSandbox,
    copySandbox,
    createSandbox,
    monitorToken,
    updateSandbox,
    deleteSandbox,
    listSandboxSessions,
    getSandboxSessionOutput,
  },
}
