import type { Secret, TWebProviderBrand } from '@tdsk/domain'

import { EWebProviderBrand } from '@tdsk/domain'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import { Autocomplete, Box, Stack, TextField, Typography } from '@mui/material'

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
        <Autocomplete
          disabled={loading}
          id='web-provider-type'
          getOptionLabel={capitalize}
          value={webProviderType || null}
          options={Object.values(EWebProviderBrand)}
          onChange={(_, val) => onWebProviderTypeChange((val as TWebProviderBrand) || '')}
          renderInput={(params) => (
            <TextField
              {...params}
              size='small'
              placeholder='Select provider...'
            />
          )}
        />
        {webProviderType && (
          <Autocomplete
            disabled={loading}
            id='web-provider-secret'
            options={secretsList.map((s) => s.id)}
            onChange={(_, val) => onWebProviderSecretIdChange(val || '')}
            value={
              secretsList.some((s) => s.id === webProviderSecretId)
                ? webProviderSecretId
                : null
            }
            getOptionLabel={(id) => {
              const secret = secretsList.find((s) => s.id === id)
              return secret?.name || id
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                size='small'
                placeholder='Select API key secret...'
              />
            )}
          />
        )}
      </Stack>
    </Box>
  )
}
