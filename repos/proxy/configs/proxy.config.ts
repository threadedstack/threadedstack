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
} = envs


export const config = {
  
}
