export type TAnyCB = (...args: any[]) => any
export type TValueOf<T> = T[keyof T]
export type TCapKeys<T extends object> = {
  [K in keyof T as Capitalize<string & K>]: T[K]
}

export type TUserHash = string

export enum EStatus {
  error = `error`,
  paused = `paused`,
  waiting = `waiting`,
  unknown = `unknown`,
  pending = `pending`,
  started = `started`,
  running = `running`,
  stopped = `stopped`,
  finished = `finished`,
  initialized = `initialized`,
}

export enum EContainerState {
  Error = `Error`,
  Missing = `Missing`,
  Running = `Running`,
  Stopped = `Stopped`,
  Creating = `Creating`,
  Succeeded = `Succeeded`,
  Terminated = `Terminated`,
}
