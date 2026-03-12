export type TParamCB = (part: string, before?: string, after?: string) => boolean

export const getParamValue = (callback: TParamCB) => {
  if (typeof window === `undefined`) return undefined

  const pathname = window.location.pathname
  if (pathname === `/`) return undefined

  const parts = pathname.split(`/`)
  return parts.find((part, idx) => callback(part, parts[idx - 1], parts[idx + 1]))
}
