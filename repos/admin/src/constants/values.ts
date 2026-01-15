import { ERoleType, EApiKeyScope, EHttpMethod } from '@tdsk/domain'

export const DefSettingsState = {}
export const SidebarWidthOpen = 240
export const SidebarWidthClosed = 60
export const HttpMethods = Object.keys(EHttpMethod)
export const ApiKeyScopes = Object.values(EApiKeyScope)

export const AllAuthRoles = [
  {
    value: ERoleType.basic,
    label: `Basic - Standard access`,
  },
  {
    value: ERoleType.admin,
    label: `Admin - User and project management`,
  },
  {
    value: ERoleType.super,
    label: `Super Admin - Full organization management`,
  },
]

// Does not contain the Super Admin auth role
export const AuthRoles = AllAuthRoles.filter((role) => role.value !== ERoleType.super)
