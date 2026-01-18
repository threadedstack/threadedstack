import { webhook } from './webhook'
import { EPMethod } from '@TBE/types'

// TODO: See https://polar.sh/docs/integrate/sdk/adapters/express#pnpm
// Add endpoints for other polar integrations
export const payments = {
  path: `/payments`,
  method: EPMethod.Use,
  endpoints: {
    webhook,
  },
}
