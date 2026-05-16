type TChipColors =
  | `default`
  | `primary`
  | `secondary`
  | `error`
  | `warning`
  | `info`
  | `success`

export const scopeChipColor = (scope: string): TChipColors => {
  switch (scope.toLowerCase()) {
    case `admin`:
      return `error`
    case `write`:
      return `warning`
    case `read`:
      return `info`
    default:
      return `default`
  }
}

export const formatScopeLabel = (scope: string): string => {
  switch (scope.toLowerCase()) {
    case `admin`:
      return `Admin`
    case `write`:
      return `Write`
    case `read`:
      return `Read Only`
    default:
      return scope.charAt(0).toUpperCase() + scope.slice(1)
  }
}

export const roleChipColor = (role: string): TChipColors => {
  switch (role.toLowerCase()) {
    case `admin`:
      return `error`
    case `member`:
      return `warning`
    case `viewer`:
      return `info`
    default:
      return `default`
  }
}

export const formatRoleLabel = (role: string): string => {
  switch (role.toLowerCase()) {
    case `admin`:
      return `Admin`
    case `member`:
      return `Member`
    case `viewer`:
      return `Viewer`
    default:
      return role.charAt(0).toUpperCase() + role.slice(1)
  }
}
