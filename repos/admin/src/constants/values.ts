import { capitalize } from '@keg-hub/jsutils/capitalize'
import {
  ERoleType,
  ESecretMode,
  EHttpMethod,
  EEPAuthType,
  EFunLanguage,
  EApiKeyScope,
  EEPVisibility,
  EApiKeyExpire,
  EEndpointType,
  EEPCredential,
  ApiKeyAllowedRoles,
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

export const ApiKeyRoles = ApiKeyAllowedRoles.map((role) => ({
  value: role,
  label: capitalize(role),
}))

export const ApiKeyRoleDesc: Record<string, string> = {
  [ERoleType.owner]: `Full org ownership — delete orgs, manage all resources and members`,
  [ERoleType.admin]: `Full administrative access — manage members, settings, and resources`,
  [ERoleType.member]: `Standard access — create, read, and update resources`,
  [ERoleType.viewer]: `Read-only access — view resources only`,
}

export const AllAuthRoles = [
  {
    value: ERoleType.viewer,
    label: `Basic - View access only`,
  },
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
