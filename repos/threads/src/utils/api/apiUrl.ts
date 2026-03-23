import {
  TDSK_PX_URL,
  TDSK_PX_HOST,
  TDSK_PX_PORT,
  TDSK_CADDY_PX_HOST,
} from '@TTH/constants/envs'

export type TAPIUrl = {
  url?: string
  host?: string
  proxy?: string
  port?: string | number
}

export const apiUrl = (opts: TAPIUrl) => {
  const {
    url = TDSK_PX_URL,
    host = TDSK_PX_HOST,
    proxy = TDSK_CADDY_PX_HOST,
    port = TDSK_PX_PORT || window.location.port,
  } = opts

  if (proxy) return proxy.startsWith(`http`) ? proxy : `https://${proxy}`

  if (url) return new URL(url).toString()
  if (!host) throw new Error(`A valid URL or host is required!`)

  let built = host
  if (!host.startsWith(`http`)) built = `${window.location.protocol}//${host}`
  if (port) built = `${built}:${port}`

  return new URL(built).toString()
}
