import { get, post, del } from './api-client'
import type { ApiResponse } from './api-client'

/**
 * Invite a user to an org via email.
 *
 * POST /_/orgs/:orgId/users/invite
 * Body: { email, roleType, expiresInDays? }
 */
export const inviteUser = async (
  orgId: string,
  email: string,
  roleType: string = 'member'
): Promise<ApiResponse<any>> => {
  return await post(`/orgs/${orgId}/users/invite`, { email, roleType })
}

/**
 * Accept an invitation with a token.
 *
 * POST /_/invitations/accept
 * Body: { token }
 */
export const acceptInvitation = async (
  token: string
): Promise<ApiResponse<any>> => {
  return await post(`/invitations/accept`, { token })
}

/**
 * Revoke/cancel a pending invitation.
 *
 * DELETE /_/invitations/:invitationId
 */
export const revokeInvitation = async (
  invitationId: string
): Promise<ApiResponse<any>> => {
  return await del(`/invitations/${invitationId}`)
}

/**
 * Get pending invitations for the current authenticated user.
 *
 * GET /_/invitations/me
 */
export const getPendingInvitations = async (): Promise<ApiResponse<any[]>> => {
  return await get(`/invitations/me`)
}

/**
 * List invitations for an org (admin only).
 *
 * GET /_/invitations/org/:orgId
 * Query: status (default: 'pending')
 */
export const listOrgInvitations = async (
  orgId: string,
  status?: string
): Promise<ApiResponse<any[]>> => {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return await get(`/invitations/org/${orgId}${query}`)
}
