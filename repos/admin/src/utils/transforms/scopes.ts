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
