export type TAnyCB = (...args: any[]) => any
export type TValueOf<T> = T[keyof T]

export type TAnyObj = Record<string, any>
export type TKeyLike = string | number | symbol

export type TCapKeys<T extends object> = {
  [K in keyof T as Capitalize<string & K>]: T[K]
}
