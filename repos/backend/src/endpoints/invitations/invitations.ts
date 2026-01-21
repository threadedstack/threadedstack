import { EPMethod } from '@TBE/types'
import { listInvitations } from './listInvitations'
import { revokeInvitation } from './revokeInvitation'
import { acceptInvitation } from './acceptInvitation'
import { getPendingInvitations } from './getPendingInvitations'

/**
 * Organization Invitations Endpoints
 *
 * Handles invitation workflow for users joining organizations
 */
export const invitations = {
  path: `/invitations`,
  method: EPMethod.Use,
  endpoints: {
    accept: acceptInvitation,
    me: getPendingInvitations,
    list: listInvitations,
    revoke: revokeInvitation,
  },
}
