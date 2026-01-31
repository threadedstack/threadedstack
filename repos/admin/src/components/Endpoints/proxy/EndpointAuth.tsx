import { AuthTypes } from '@TAF/constants/values'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { TextInput, SelectInput, SwitchInput } from '@tdsk/components'
import {
  Box,
  Chip,
  Alert,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TEndpointAuthProps = {
  loading: boolean
  enabled: boolean
  secretName: string
  headerName: string
  type: `bearer` | `basic` | `apikey`
  onEnabledChange: (value: boolean) => void
  onSecretNameChange: (value: string) => void
  onHeaderNameChange: (value: string) => void
  onTypeChange: (value: `bearer` | `basic` | `apikey`) => void
}

export const EndpointAuth = (props: TEndpointAuthProps) => {
  const {
    type,
    loading,
    enabled,
    secretName,
    headerName,
    onTypeChange,
    onEnabledChange,
    onSecretNameChange,
    onHeaderNameChange,
  } = props

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant='subtitle1'
          fontWeight={500}
        >
          Authentication
        </Typography>
        {enabled && (
          <Chip
            size='small'
            color='primary'
            sx={{ ml: 1 }}
            label={type.toUpperCase()}
          />
        )}
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SwitchInput
            disabled={loading}
            id='auth-enabled'
            checked={enabled}
            label='Enable Authentication'
            onChange={(e, checked) => onEnabledChange(checked)}
          />

          {enabled && (
            <>
              <SelectInput
                id='auth-type'
                value={type}
                items={AuthTypes}
                disabled={loading}
                label='Auth Type'
                onChange={(e) => onTypeChange(e.target.value as typeof type)}
              />
              <TextInput
                fullWidth
                disabled={loading}
                label='Secret Name'
                id='auth-secret-name'
                value={secretName}
                placeholder='API_KEY or {{API_KEY}}'
                onChange={(e) => onSecretNameChange(e.target.value)}
              />
              <TextInput
                fullWidth
                disabled={loading}
                label='Header Name'
                id='auth-header-name'
                value={headerName}
                placeholder='Authorization'
                onChange={(e) => onHeaderNameChange(e.target.value)}
              />
            </>
          )}

          <Alert
            severity='info'
            sx={{ fontSize: '0.875rem' }}
          >
            Configure authentication using secrets. Secret value will be injected into the
            specified header.
          </Alert>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
