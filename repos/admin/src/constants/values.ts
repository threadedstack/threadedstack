import { capitalize } from '@keg-hub/jsutils/capitalize'
import {
  ERoleType,
  ESecretMode,
  EHttpMethod,
  EEPAuthType,
  EFunLanguage,
  EEPVisibility,
  EApiKeyExpire,
  EEndpointType,
  EEPCredential,
} from '@tdsk/domain'

export const DefSettingsState = {}
export const SubNavPanelWidth = 200
export const SidebarWidthOpen = 240
export const SidebarWidthClosed = 60
export const NavRailExpandedWidth = 200
export const HttpMethods = Object.keys(EHttpMethod)
export const EPVisibility = Object.values(EEPVisibility)

export const ApiKeysExpire = [
  { label: `7 days`, value: EApiKeyExpire.d7 },
  { label: `30 days`, value: EApiKeyExpire.d30 },
  { label: `90 days`, value: EApiKeyExpire.d90 },
  { label: `180 days`, value: EApiKeyExpire.d180 },
  { label: `1 year`, value: EApiKeyExpire.y1 },
  { label: `Never expires`, value: EApiKeyExpire.never },
]

export const AllAuthRoles = [
  {
    value: ERoleType.member,
    label: `Member - Standard access`,
  },
  {
    value: ERoleType.admin,
    label: `Admin - User and project management`,
  },
  {
    value: ERoleType.owner,
    label: `Owner - Full organization management`,
  },
  {
    value: ERoleType.super,
    label: `Super Admin - Full organization management`,
  },
]

// Does not contain the Super Admin auth role
export const AuthRoles = AllAuthRoles.map((role) => {
  return role.value === ERoleType.super ? { ...role, disabled: true } : role
})

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

export const SecretModeOptions = [
  { value: ESecretMode.none, label: `None` },
  { value: ESecretMode.new, label: `Create new secret` },
  { value: ESecretMode.existing, label: `Select existing secret` },
]

export const PlanSections = [
  { key: `projects`, label: `Projects`, suffix: `` },
  { key: `endpoints`, label: `Endpoints`, suffix: `` },
  { key: `compute`, label: `Compute`, suffix: `seconds` },
  { key: `threads`, label: `Threads`, suffix: `` },
  { key: `messages`, label: `Messages`, suffix: `` },
  { key: `secrets`, label: `Secrets`, suffix: `` },
] as const
