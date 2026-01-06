import { LOG_LEVEL } from '@TPX/constants/envs'
import { toInt } from '@keg-hub/jsutils/toInt'
import { toBool } from '@keg-hub/jsutils/toBool'
import { loadEnvs, generateOrigins } from '@tdsk/domain'



const {
  NODE_ENV=`local`,
} = process.env



const envs = loadEnvs({
  name: `tdsk`,
  override: NODE_ENV === `local`,
})

const {
  TDSK_PX_LOGGER_LEVEL,
  TDSK_PX_LOGGER_PRETTY,
  TDSK_PX_LOGGER_SILENT,
} = envs


export const config = {
  logger: {
    label: `TDSK - Proxy`,
    exceptions: true,
    rejections: true,
    exitOnError: false,
    level: TDSK_PX_LOGGER_LEVEL ?? LOG_LEVEL,
    pretty: toBool(TDSK_PX_LOGGER_PRETTY) ?? false,
    silent: toBool(TDSK_PX_LOGGER_SILENT) ?? false,
  },
}
