import { TDSK_PX_URL, TDSK_PX_HOST, TDSK_PX_PORT } from '@TAF/constants/envs'

export type TAPIUrl = {
  url?: string
  host?: string
  port?: string | number
}

export const apiUrl = (opts: TAPIUrl) => {
  const {
    url = TDSK_PX_URL,
    host = TDSK_PX_HOST,
    port = TDSK_PX_PORT || window.location.port,
  } = opts

  if (url) return new URL(url).toString()
  if (!host) throw new Error(`A valid URL or host is required!`)

  let built = host
  if (!host.startsWith(`http`)) built = `${window.location.protocol}//${host}`
  if (port) built = `${built}:${port}`

  return new URL(built).toString()
}
