import { SwitchInput } from '@tdsk/components'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Box,
  Chip,
  Alert,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TEndpointTransformProps = {
  loading: boolean
  enabled: boolean
  injectSecrets: boolean
  onEnabledChange: (value: boolean) => void
  onInjectSecretsChange: (value: boolean) => void
}

export const EndpointTransform = (props: TEndpointTransformProps) => {
  const { loading, enabled, injectSecrets, onEnabledChange, onInjectSecretsChange } =
    props

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant='subtitle1'
          fontWeight={500}
        >
          Transform
        </Typography>
        {enabled && (
          <Chip
            size='small'
            label='Enabled'
            color='primary'
            sx={{ ml: 1 }}
          />
        )}
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SwitchInput
            disabled={loading}
            id='transform-enabled'
            label='Enable Transform'
            checked={enabled}
            onChange={(e, checked) => onEnabledChange(checked)}
          />

          {enabled && (
            <SwitchInput
              disabled={loading}
              id='transform-inject-secrets'
              label='Inject Secrets in Body'
              checked={injectSecrets}
              onChange={(e, checked) => onInjectSecretsChange(checked)}
            />
          )}

          <Alert
            severity='info'
            sx={{ fontSize: '0.875rem' }}
          >
            Transform request/response bodies. Secret injection replaces {'{{'} and{' '}
            {' }}'} references.
          </Alert>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
