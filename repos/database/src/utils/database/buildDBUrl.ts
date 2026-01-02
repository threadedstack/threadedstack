import { URL } from 'url'
import { DefDBProto } from '@TDB/constants/values'


export type TBuildDBUrl = {
  url?:string
  host?:string
  user?:string
  pass?:string
  name?:string
  proto?:string
  params?:Record<string, string>
}

const ensureProto = (url:string, proto?:string) => {
  const hasProto = /^[a-zA-Z0-9]+:\/\//.test(url)

  if(!proto) return hasProto ? url : `${DefDBProto}://${url}`

  if(!hasProto) return `${proto}://${url}`

  const uri = url.split(`://`).pop()
  return `${proto}://${uri}`
}

const getDBUrl = (opts: TBuildDBUrl) => {
  const { url, host, proto } = opts

  if (url) return new URL(ensureProto(url, proto))

  if (!host)
    throw new Error(`Can not build DB connection string, either a "url" or "host" must be provided`)

  return new URL(ensureProto(host, proto))
}

const addParams = (url:URL, params:Record<string, string>) => {
  Object.entries(params).forEach(([key, value]) => {
    !url.searchParams.has(key)
      && url.searchParams.append(key, value)
  })

  return url
}

/**
 * Add the Database Name mapped to the URL pathname
 * Trim leading slashes from input schema to avoid double slashes (e.g. //public)
 */
const addName = (url:URL, name:string) => {
  const current = url.pathname === `/` ? `` : url.pathname
  if (!current) url.pathname = `/${name.replace(/^\/+/, ``)}`

  return url
}


/** Build the DB url connection string based on the passed in options
 * If the passed in `url` exists
   * It should be validated
   * Any missing parts in the url that exist in the other options should be added to the URL in the correct location
   * Then the updated `url` should be returned
 * If the passed in `url` does NOT exists
 * Then it should be built from the other passed in options and returned as a valid connection string 
 */
export const buildDBUrl = (opts: TBuildDBUrl): string => {
  const {
    user,
    pass,
    name,
    params,
  } = opts

  let url = getDBUrl(opts)

  if (user && !url.username) url.username = user
  if (pass && !url.password) url.password = pass

  if (params) url = addParams(url, params)
  if (name) url = addName(url, name)

  return url.toString()
}