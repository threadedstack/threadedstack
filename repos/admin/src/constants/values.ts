import { capitalize } from '@keg-hub/jsutils/capitalize'
import {
  ERoleType,
  EHttpMethod,
  EEPAuthTypes,
  EFunLanguage,
  EApiKeyScope,
  EEPVisibility,
  EEPCredentialOpts,
} from '@tdsk/domain'

export const DefSettingsState = {}
export const SidebarWidthOpen = 240
export const SidebarWidthClosed = 60
export const HttpMethods = Object.keys(EHttpMethod)
export const ApiKeyScopes = Object.values(EApiKeyScope)
export const EPVisibility = Object.values(EEPVisibility)

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
