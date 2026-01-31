import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { TextInput, SwitchInput } from '@tdsk/components'
import {
  Box,
  Chip,
  Alert,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TEndpointWhitelistProps = {
  loading: boolean
  enabled: boolean
  domains: string
  enforce: boolean
  logBlocked: boolean
  onEnabledChange: (value: boolean) => void
  onDomainsChange: (value: string) => void
  onEnforceChange: (value: boolean) => void
  onLogBlockedChange: (value: boolean) => void
}

export const EndpointWhitelist = (props: TEndpointWhitelistProps) => {
  const {
    loading,
    enabled,
    domains,
    enforce,
    logBlocked,
    onEnabledChange,
    onDomainsChange,
    onEnforceChange,
    onLogBlockedChange,
  } = props

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant='subtitle1'
          fontWeight={500}
        >
          Domain Whitelist
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
            id='whitelist-enabled'
            label='Enable Domain Whitelist'
            checked={enabled}
            onChange={(e, checked) => onEnabledChange(checked)}
          />

          {enabled && (
            <>
              <TextInput
                fullWidth
                value={domains}
                id='whitelist-domains'
                label='Allowed Domains'
                disabled={loading}
                placeholder='example.com, *.api.example.com'
                onChange={(e) => onDomainsChange(e.target.value)}
              />
              <SwitchInput
                disabled={loading}
                id='whitelist-enforce'
                label='Enforce Whitelist'
                checked={enforce}
                onChange={(e, checked) => onEnforceChange(checked)}
              />
              <SwitchInput
                disabled={loading}
                id='whitelist-log-blocked'
                label='Log Blocked Attempts'
                checked={logBlocked}
                onChange={(e, checked) => onLogBlockedChange(checked)}
              />
            </>
          )}

          <Alert
            severity='info'
            sx={{ fontSize: '0.875rem' }}
          >
            Restrict endpoint access to specific domains. Supports wildcards
            (*.example.com).
          </Alert>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
