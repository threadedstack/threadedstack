import type { TRoleType } from './permissions.types'
import type { Organization } from '@TDM/models/organization'

export type TOrgWithRole = Organization & { userRole: TRoleType }
