export type TEnvFilter = {
  add: string[]
  ends: string[]
  starts: string[]
  contains: string[]
  exclude: string[]
}

export const EnvFilter: TEnvFilter = {
  starts: [`npm_`, `HOME`, `KEG_`, `FIREBASE`, `FIRE_BASE`, `GOOGLE`, `AZURE`, `AWS`],
  // Need better way to handle this relative to secrets
  // Otherwise can't pass secrets via ENV when running in CI
  contains: [],
  ends: [`_PATH`, `_PORT`],
  exclude: [],
  add: [],
}
