export enum ESandboxMode {
  tui = `tui`,
  idle = `idle`,
  streaming = `streaming`,
  interactive = `interactive`,
}

export type TSandboxMode = `${ESandboxMode}`
