import { EHttpMethod, EApiKeyScope } from '@tdsk/domain'

export const sigs = [`SIGINT`, `SIGTERM`, `SIGQUIT`]

export const AuthIgnore = [`/`, `/health`]

export const LoggerIgnore = {
  methods: [`OPTIONS`],
  routes: [`/.well-known/appspecific/com.chrome.devtools.json`],
}

export const HttpMethods = Object.values(EHttpMethod)
export const AllowedScopes: string[] = Object.values(EApiKeyScope)
export const DefUserProxyOpts = {
  retries: 3,
  delay: 1000,
  timeout: 30000,
}
