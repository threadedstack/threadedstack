import { webhook } from './webhook'
import { EPMethod } from '@TBE/types'

export const payments = {
  path: `/payments`,
  method: EPMethod.Use,
  endpoints: {
    webhook,
  },
}
