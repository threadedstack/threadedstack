export type TParamCB = (part: string, before?: string, after?: string) => boolean

export const getParamValue = (callback: TParamCB) => {
  let value: string = undefined
  if (typeof window === `undefined`) return value

  const pathname = window.location.pathname
  if (pathname === `/`) return value

  const parts = pathname.split(`/`)

  return parts.find((part, idx) => callback(part, parts[idx - 1], parts[idx + 1]))
}
