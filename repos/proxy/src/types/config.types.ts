import type { TLogLevel } from '@TPX/types/envs.types'

export type TServerConfig = {
  port: number
  enableSSL: boolean
  origins: string[]
  certs?: {
    ca?: string
    key?: string
    cert?: string
  }
}

export type TBackendConfig = {
  url: string
  adminPath?: string
  headerKey?: string
  headerValue?: string
}

export type TLoggerConfig = {
  label: string
  level: TLogLevel
  pretty: boolean
  silent: boolean
  exceptions: boolean
  rejections: boolean
  exitOnError: boolean
}

export type TJWKSConfig = {
  jwksUrl: string
}

export type TDomainsConfig = {
  prewarmHeader: string
}

export type TProxyConfig = {
  jwks: TJWKSConfig
  server: TServerConfig
  logger: TLoggerConfig
  backend: TBackendConfig
  domains: TDomainsConfig
}
