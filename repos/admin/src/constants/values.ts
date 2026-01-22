import {
  ERoleType,
  EApiKeyScope,
  EHttpMethod,
  EEPAuthTypes,
  EEPCredentialOpts,
} from '@tdsk/domain'

export const DefSettingsState = {}
export const SidebarWidthOpen = 240
export const SidebarWidthClosed = 60
export const HttpMethods = Object.keys(EHttpMethod)
export const ApiKeyScopes = Object.values(EApiKeyScope)

export const AllAuthRoles = [
  {
    value: ERoleType.viewer,
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

export const AuthTypes = [
  { value: EEPAuthTypes.apikey, label: `API Key` },
  { value: EEPAuthTypes.basic, label: `Basic Auth` },
  { value: EEPAuthTypes.bearer, label: `Bearer Token` },
]

export const CredentialOpts = [
  { value: EEPCredentialOpts.body, label: `Body (Form Params)` },
  { value: EEPCredentialOpts.header, label: `Header (Basic Auth)` },
]
