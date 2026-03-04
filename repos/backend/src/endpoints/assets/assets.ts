import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getAsset } from '@TBE/endpoints/assets/getAsset'
import { listAssets } from '@TBE/endpoints/assets/listAssets'
import { createAsset } from '@TBE/endpoints/assets/createAsset'
import { updateAsset } from '@TBE/endpoints/assets/updateAsset'
import { deleteAsset } from '@TBE/endpoints/assets/deleteAsset'

export const assets: TEndpointConfig = {
  path: `/assets`,
  method: EPMethod.Use,
  endpoints: {
    listAssets,
    getAsset,
    createAsset,
    updateAsset,
    deleteAsset,
  },
}
