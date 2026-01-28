import hq from 'alias-hq'
import { version } from '../package.json'
import { loadEnvs } from '../scripts/loadEnvs'

const aliases = hq.get(`webpack`)
const nodeEnv = process.env.NODE_ENV || `local`
const overrideEnvs = process.env.TDSK_AD_OVERRIDE_ENVS
const envOverride = Boolean(overrideEnvs || nodeEnv === `local`)

type TFECfg = {
  port: string | number
  environment: string
  envs: Record<string, string>
  aliases: Record<string, string>
}

export const loadConfig = () => {
  /*
   * Load the configuration files from the root `configs` directory, and then add them to the process.
   */
  loadEnvs({
    env: nodeEnv,
    force: envOverride,
  })

  const envs = Object.entries(process.env).reduce(
    (acc, [key, value]) => {
      if (!key.startsWith(`TDSK_`) || value === '') return acc
      acc[`process.env.${key}`] = JSON.stringify(value)
      return acc
    },
    {} as Record<string, string>
  )

  return {
    aliases,
    environment: nodeEnv,
    port: Number.parseInt(process.env.TDSK_AD_PORT || `5887`, 10),
    envs: {
      ...envs,
      [`process.env.NODE_ENV`]: JSON.stringify(process.env.NODE_ENV),
      [`process.env.TDSK_AD_APP_VERSION`]: JSON.stringify(
        process.env.TDSK_AD_APP_VERSION || version
      ),
      ...(envOverride ? {} : { [`process.env`]: {} }),
    } as Record<string, string | Record<string, string>>,
  } as TFECfg
}
