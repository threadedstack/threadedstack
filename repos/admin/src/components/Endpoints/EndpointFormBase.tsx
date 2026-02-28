import type { TSharedFormState } from '@TAF/types/endpoints.types'

import { Box, Alert } from '@mui/material'
import { EndpointTypeOpts, HttpMethodOps } from '@TAF/constants/values'
import { TextInput, SelectInput, SwitchInput } from '@tdsk/components'

export type TEndpointFormBaseProps = {
  disabled?: boolean
  sharedState: TSharedFormState
  onChange: (updates: Partial<TSharedFormState>) => void
}

export const EndpointFormBase = (props: TEndpointFormBaseProps) => {
  const { onChange, sharedState, disabled = false } = props

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
      <TextInput
        required
        fullWidth
        id='endpoint-name'
        disabled={disabled}
        label='Endpoint Name'
        value={sharedState.name}
        placeholder='Enter endpoint name'
        onChange={(e) => onChange({ name: e.target.value })}
      />

      <SelectInput
        required
        id='endpoint-type'
        disabled={disabled}
        label='Endpoint Type'
        items={EndpointTypeOpts}
        value={sharedState.endpointType}
        onChange={(e) =>
          onChange({
            endpointType: e.target.value as typeof sharedState.endpointType,
          })
        }
      />

      <SelectInput
        required
        id='endpoint-method'
        disabled={disabled}
        label='HTTP Method'
        items={HttpMethodOps}
        value={sharedState.method}
        onChange={(e) => onChange({ method: e.target.value })}
      />

      <TextInput
        required
        fullWidth
        id='endpoint-path'
        disabled={disabled}
        label='Endpoint Path'
        value={sharedState.path}
        placeholder='/custom/path'
        onChange={(e) => onChange({ path: e.target.value })}
      />

      <SwitchInput
        disabled={disabled}
        id='public-endpoint'
        label='Public Endpoint'
        checked={sharedState.public}
        onChange={(e, checked) => onChange({ public: checked })}
      />
      <Box sx={{ ml: 4, mt: -1 }}>
        <Alert
          severity='info'
          sx={{ fontSize: `0.875rem` }}
        >
          {sharedState.public
            ? `Accessible without authentication`
            : `Requires authentication`}
        </Alert>
      </Box>
    </Box>
  )
}
