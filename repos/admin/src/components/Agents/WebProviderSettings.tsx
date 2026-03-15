import type { Secret, TWebProviderBrand } from '@tdsk/domain'

import { EWebProviderBrand } from '@tdsk/domain'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import { Autocomplete, Box, Stack, TextField, Typography } from '@mui/material'

export type TWebProviderSettings = {
  loading: boolean
  secretsList: Secret[]
  webProviderType: TWebProviderBrand | ''
  webProviderSecretId: string
  onWebProviderTypeChange: (value: TWebProviderBrand | '') => void
  onWebProviderSecretIdChange: (value: string) => void
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
          id='web-provider-type'
          disabled={loading}
          value={webProviderType || null}
          options={Object.values(EWebProviderBrand)}
          getOptionLabel={capitalize}
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
            id='web-provider-secret'
            disabled={loading}
            value={
              secretsList.some((s) => s.id === webProviderSecretId)
                ? webProviderSecretId
                : null
            }
            options={secretsList.map((s) => s.id)}
            getOptionLabel={(id) => {
              const secret = secretsList.find((s) => s.id === id)
              return secret?.name || id
            }}
            onChange={(_, val) => onWebProviderSecretIdChange(val || '')}
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
