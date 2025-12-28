import { loadEnvs } from '@tdsk/domain'
const {
  TDSK_DB_URL,
  TDSK_DB_TYPE,
  TDSK_DB_NAME,
  TDSK_DB_JWT_SCRT,
  TDSK_DB_SRV_ROLE,
  TDSK_DB_PUBLIC_KEY,
} = process.env

const nodeEnv = process.env.NODE_ENV || `local`
const envs = loadEnvs({
  name: `tdsk`,
  override: nodeEnv === `local`,
})

export const config = {
  type: TDSK_DB_TYPE,
  [TDSK_DB_TYPE]: {
    url: TDSK_DB_URL,
    name: TDSK_DB_NAME,
    jwt: TDSK_DB_JWT_SCRT,
    role: TDSK_DB_SRV_ROLE,
    public: TDSK_DB_PUBLIC_KEY,
  }
}
