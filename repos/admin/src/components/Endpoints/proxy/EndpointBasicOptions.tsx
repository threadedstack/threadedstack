import { TextInput, SwitchInput } from '@tdsk/components'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Chip,
  Box,
  Alert,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TEndpointBasicOptionsProps = {
  loading: boolean
  timeout: string
  retries: string
  pathRegex: string
  retryDelay: string
  retryMaxDelay: string
  retryBackoffMultiplier: string
  retryExponentialBackoff: boolean
  onTimeoutChange: (value: string) => void
  onRetriesChange: (value: string) => void
  onPathRegexChange: (value: string) => void
  onRetryDelayChange: (value: string) => void
  onRetryMaxDelayChange: (value: string) => void
  onRetryBackoffMultiplierChange: (value: string) => void
  onRetryExponentialBackoffChange: (value: boolean) => void
}

export const EndpointBasicOptions = (props: TEndpointBasicOptionsProps) => {
  const {
    loading,
    timeout,
    retries,
    pathRegex,
    retryDelay,
    retryMaxDelay,
    onTimeoutChange,
    onRetriesChange,
    onPathRegexChange,
    onRetryDelayChange,
    onRetryMaxDelayChange,
    retryBackoffMultiplier,
    retryExponentialBackoff,
    onRetryBackoffMultiplierChange,
    onRetryExponentialBackoffChange,
  } = props

  const hasRetries = retries && Number.parseInt(retries, 10) > 0

  const isConfigured = timeout || retries || pathRegex

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant='subtitle1'
          fontWeight={500}
        >
          Basic Options
        </Typography>
        {isConfigured && (
          <Chip
            size='small'
            label='Configured'
            color='primary'
            sx={{ ml: 1 }}
          />
        )}
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextInput
            fullWidth
            type='number'
            value={timeout}
            id='endpoint-timeout'
            label='Timeout (ms)'
            disabled={loading}
            placeholder='30000'
            onChange={(e) => onTimeoutChange(e.target.value)}
          />
          <TextInput
            fullWidth
            type='number'
            value={retries}
            id='endpoint-retries'
            label='Max Retries'
            disabled={loading}
            placeholder='3'
            onChange={(e) => onRetriesChange(e.target.value)}
          />

          {hasRetries && (
            <>
              <Typography
                variant='body2'
                sx={{ mt: 1, fontWeight: 500 }}
              >
                Retry Configuration
              </Typography>
              <TextInput
                fullWidth
                type='number'
                value={retryDelay}
                disabled={loading}
                placeholder='1000'
                id='endpoint-retry-delay'
                label='Initial Retry Delay (ms)'
                onChange={(e) => onRetryDelayChange(e.target.value)}
              />
              <TextInput
                fullWidth
                type='number'
                disabled={loading}
                placeholder='30000'
                value={retryMaxDelay}
                id='endpoint-retry-max-delay'
                label='Max Retry Delay (ms)'
                onChange={(e) => onRetryMaxDelayChange(e.target.value)}
              />
              <TextInput
                fullWidth
                type='number'
                placeholder='2'
                disabled={loading}
                label='Backoff Multiplier'
                value={retryBackoffMultiplier}
                id='endpoint-retry-backoff-multiplier'
                onChange={(e) => onRetryBackoffMultiplierChange(e.target.value)}
              />
              <SwitchInput
                disabled={loading}
                label='Exponential Backoff'
                id='retry-exponential-backoff'
                checked={retryExponentialBackoff}
                onChange={(e, checked) => onRetryExponentialBackoffChange(checked)}
              />
              <Alert
                severity='info'
                sx={{ fontSize: '0.875rem' }}
              >
                {retryExponentialBackoff
                  ? `Retry delays increase exponentially (${retryDelay || '1000'}ms → ${
                      Number.parseInt(retryDelay || '1000', 10) *
                        Number.parseFloat(retryBackoffMultiplier || '2') || '2000'
                    }ms → ${
                      Number.parseInt(retryDelay || '1000', 10) *
                        Math.pow(Number.parseFloat(retryBackoffMultiplier || '2'), 2) ||
                      '4000'
                    }ms...)`
                  : `Fixed delay of ${retryDelay || '1000'}ms between retries`}
              </Alert>
            </>
          )}

          <TextInput
            fullWidth
            value={pathRegex}
            label='Path Regex'
            disabled={loading}
            placeholder='/api/v1/.*'
            id='endpoint-path-regex'
            onChange={(e) => onPathRegexChange(e.target.value)}
          />
          <Alert
            severity='info'
            sx={{ fontSize: '0.875rem' }}
          >
            Configure request timeout, retry behavior with exponential backoff, and path
            pattern matching.
          </Alert>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
