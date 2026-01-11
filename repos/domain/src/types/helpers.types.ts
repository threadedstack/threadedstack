export type TAnyCB = (...args: any[]) => any
export type TValueOf<T> = T[keyof T]
export type TCapKeys<T extends object> = {
  [K in keyof T as Capitalize<string & K>]: T[K]
}
