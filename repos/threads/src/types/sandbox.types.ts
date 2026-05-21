export enum ESandboxMode {
  tui = `tui`,
  idle = `idle`,
  streaming = `streaming`,
  interactive = `interactive`,
}

export type TSandboxMode = `${ESandboxMode}`

export type TSandboxStatus =
  | `idle`
  | `active`
  | `failed`
  | `closed`
  | `pending`
  | `running`
  | `stopped`
  | `building`

export type TStatusChip = {
  size?: `sm` | `md`
  status: TSandboxStatus
}
