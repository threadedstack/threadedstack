export type TErrorArgs = [number, string, string?]
export type TErrorMethod = (...args: any[]) => TErrorArgs
export type TErrorItems = Record<string, TErrorArgs | TErrorMethod>
export type TThrowExceptions = Record<string, (...args: any) => void>
