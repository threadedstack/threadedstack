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
  // ADD Shell ENVs as needed
} = process.env

export const config = {
  logger: {
    label: `TDSK - Shell`,
    level: TDSK_LOG_LEVEL,
  },
}
