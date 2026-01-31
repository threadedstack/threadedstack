import type { TKeyValuePair } from '@TAF/types'
import type { Secret } from '@tdsk/domain'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import {
  Box,
  Chip,
  Alert,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TEndpointHeadersProps = {
  loading: boolean
  headers: TKeyValuePair[]
  availableSecrets: Secret[]
  onChange: (pairs: TKeyValuePair[]) => void
}

export const EndpointHeaders = (props: TEndpointHeadersProps) => {
  const { loading, headers, onChange, availableSecrets } = props

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant='subtitle1'
          fontWeight={500}
        >
          Headers
        </Typography>
        {headers.length > 0 && (
          <Chip
            size='small'
            label={headers.length}
            sx={{ ml: 1 }}
          />
        )}
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <KeyValueEditor
            pairs={headers}
            disabled={loading}
            secrets={availableSecrets}
            keyPlaceholder='Header Name'
            valuePlaceholder='Header Value or {{secret-name}}'
            enableSecretReferences={true}
            onChange={onChange}
          />
          <Alert
            severity='info'
            sx={{ fontSize: '0.875rem' }}
          >
            Custom headers included in proxied requests. Use {'{{'} and {'}}'} to
            reference secrets.
          </Alert>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
