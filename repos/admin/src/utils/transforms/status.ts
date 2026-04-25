export type TStatusColor = `default` | `primary` | `success` | `warning` | `error`

export const statusColor = (status: string): TStatusColor => {
  switch (status.toLowerCase()) {
    case `active`:
      return `success`
    case `trialing`:
      return `primary`
    case `past_due`:
      return `warning`
    case `canceled`:
    case `incomplete`:
    case `incomplete_expired`:
    case `unpaid`:
      return `error`
    default:
      return `default`
  }
}
