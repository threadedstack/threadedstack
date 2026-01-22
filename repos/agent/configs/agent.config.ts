import { toBool } from '@keg-hub/jsutils'
import { loadEnvs } from '@tdsk/domain'

const nodeEnv = process.env.NODE_ENV || `local`

/*
 * Load the Envs for the configuration files from the repo root, and then add them to the process.
 * When running locally we want to make it easy to update the values by just changing the values.yml file
 * But in deployed envs, we want don't want to override the environments ENVs
 * So only pass true when in local, so the values.yml file becomes the source of truth
 */
loadEnvs({ force: nodeEnv === `local` })

const {
  TDSK_LOG_LEVEL,
  TDSK_AG_LOG_LEVEL,
  TDSK_BE_LOGGER_PRETTY,
  TDSK_AG_LOGGER_SILENT,
} = process.env

export const config = {
  logger: {
    label: `TDSK - Agent`,
    exceptions: true,
    rejections: true,
    exitOnError: false,
    level: TDSK_AG_LOG_LEVEL ?? TDSK_LOG_LEVEL,
    pretty: toBool(TDSK_BE_LOGGER_PRETTY) ?? false,
    silent: toBool(TDSK_AG_LOGGER_SILENT) ?? false,
  },
}
