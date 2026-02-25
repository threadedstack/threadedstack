import { capitalize } from '@keg-hub/jsutils/capitalize'
import {
  ERoleType,
  EHttpMethod,
  EEPAuthType,
  EFunLanguage,
  EApiKeyScope,
  EEPVisibility,
  EApiKeyExpire,
  EEndpointType,
  EEPCredential,
} from '@tdsk/domain'

export const NavRailWidth = 60
export const DefSettingsState = {}
export const SubNavPanelWidth = 200
export const SidebarWidthOpen = 240
export const SidebarWidthClosed = 60
export const NavRailExpandedWidth = 200
export const HttpMethods = Object.keys(EHttpMethod)
export const ApiKeyScopes = Object.values(EApiKeyScope)
export const EPVisibility = Object.values(EEPVisibility)

export const ApiKeysExpire = [
  { label: `7 days`, value: EApiKeyExpire.d7 },
  { label: `30 days`, value: EApiKeyExpire.d30 },
  { label: `90 days`, value: EApiKeyExpire.d90 },
  { label: `180 days`, value: EApiKeyExpire.d180 },
  { label: `1 year`, value: EApiKeyExpire.y1 },
  { label: `Never expires`, value: EApiKeyExpire.never },
]

export const ApiKeyScopeDesc = {
  [EApiKeyScope.admin]: `Full administrative access`,
  [EApiKeyScope.write]: `Create and update resources`,
  [EApiKeyScope.read]: `Read-only access to resources`,
}

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
  { value: EEPAuthType.apikey, label: `API Key` },
  { value: EEPAuthType.basic, label: `Basic Auth` },
  { value: EEPAuthType.bearer, label: `Bearer Token` },
]

export const CredentialOpts = [
  { value: EEPCredential.body, label: `Body (Form Params)` },
  { value: EEPCredential.header, label: `Header (Basic Auth)` },
]

export const LanguageOpts = Object.values(EFunLanguage).map((value) => ({
  value,
  label: capitalize(value),
}))

export const HttpMethodOps = HttpMethods.map((method) => {
  return {
    label: method,
    value: method.toLowerCase(),
  }
})

export const EPVisibilityOpts = EPVisibility.map((value) => {
  return {
    value,
    label: capitalize(value),
  }
})

export const EndpointTypeOpts = Object.values(EEndpointType).map((value) => ({
  value,
  label: capitalize(value),
}))
