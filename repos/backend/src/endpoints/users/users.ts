import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getUser } from '@TBE/endpoints/users/getUser'
import { listUsers } from '@TBE/endpoints/users/listUsers'
import { createUser } from '@TBE/endpoints/users/createUser'
import { updateUser } from '@TBE/endpoints/users/updateUser'
import { deleteUser } from '@TBE/endpoints/users/deleteUser'

export const users: TEndpointConfig = {
  path: `/users`,
  method: EPMethod.Use,
  endpoints: {
    listUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
  },
}
