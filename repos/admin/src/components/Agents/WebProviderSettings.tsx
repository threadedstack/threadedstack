import type { Secret, TWebProviderBrand } from '@tdsk/domain'

import { SelectInput } from '@tdsk/components'
import { EWebProviderBrand } from '@tdsk/domain'
import { Box, Stack, Typography } from '@mui/material'
import { capitalize } from '@keg-hub/jsutils/capitalize'

export type TWebProviderSettings = {
  loading: boolean
  secretsList: Secret[]
  webProviderSecretId: string
  webProviderType: TWebProviderBrand | ``
  onWebProviderSecretIdChange: (value: string) => void
  onWebProviderTypeChange: (value: TWebProviderBrand | ``) => void
}

export const WebProviderSettings = (props: TWebProviderSettings) => {
  const {
    loading,
    secretsList,
    webProviderType,
    webProviderSecretId,
    onWebProviderTypeChange,
    onWebProviderSecretIdChange,
  } = props

  return (
    <Box>
      <Typography
        variant='subtitle2'
        sx={{ fontWeight: 600, mb: 2 }}
      >
        Web Provider
      </Typography>
      <Stack spacing={2}>
        <SelectInput
          id='web-provider-type'
          disabled={loading}
          value={webProviderType}
          placeholder='Select provider...'
          items={Object.values(EWebProviderBrand).map((v) => ({
            value: v,
            label: capitalize(v),
          }))}
          onChange={(e) =>
            onWebProviderTypeChange((e.target.value as TWebProviderBrand) || '')
          }
        />
        {webProviderType && (
          <SelectInput
            disabled={loading}
            id='web-provider-secret'
            placeholder='Select API key secret...'
            value={
              secretsList.some((s) => s.id === webProviderSecretId)
                ? webProviderSecretId
                : ''
            }
            items={secretsList.map((s) => ({ value: s.id, label: s.name || s.id }))}
            onChange={(e) => onWebProviderSecretIdChange(e.target.value as string)}
          />
        )}
      </Stack>
    </Box>
  )
}
