import {
  Box,
  Chip,
  Button,
  TextField,
  Typography,
  IconButton,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  ClearAll as ClearIcon,
} from '@mui/icons-material'
import { Code } from '@TAF/components/Code/Code'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import {
  useEndpointTest,
  contentTypeToLanguage,
} from '@TAF/hooks/endpoints/useEndpointTest'

const bodylessMethods = ['GET', 'HEAD']

const statusColor = (status: number): 'success' | 'warning' | 'error' => {
  if (status < 300) return 'success'
  if (status < 400) return 'warning'
  return 'error'
}

export type TEndpointTestPanel = {
  method: string
  projectId: string
  endpointId: string
}

export const EndpointTestPanel = (props: TEndpointTestPanel) => {
  const { method, projectId, endpointId } = props

  const {
    request,
    response,
    loading,
    error,
    monacoLanguage,
    setBody,
    addHeader,
    removeHeader,
    updateHeader,
    sendRequest,
    clearResponse,
  } = useEndpointTest({ method, projectId, endpointId })

  const showBody = !bodylessMethods.includes(request.method.toUpperCase())

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && (
        <ErrorAlert
          message={error}
          onClose={() => clearResponse()}
        />
      )}

      {/* Method display */}
      <Chip
        label={`Method: ${request.method.toUpperCase()}`}
        variant='outlined'
        size='small'
        sx={{ alignSelf: 'flex-start' }}
      />

      {/* Headers */}
      <Box>
        <Typography
          variant='subtitle2'
          sx={{ mb: 1 }}
        >
          Headers
        </Typography>
        {request.headers.map((header, index) => (
          <Box
            key={index}
            sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
          >
            <TextField
              size='small'
              placeholder='Key'
              value={header.key}
              onChange={(e) => updateHeader(index, 'key', e.target.value)}
              sx={{ flex: 1, '& .MuiInputBase-root': { bgcolor: 'background.paper' } }}
            />
            <TextField
              size='small'
              placeholder='Value'
              value={header.value}
              onChange={(e) => updateHeader(index, 'value', e.target.value)}
              sx={{ flex: 2, '& .MuiInputBase-root': { bgcolor: 'background.paper' } }}
            />
            <IconButton
              size='small'
              onClick={() => removeHeader(index)}
              aria-label='Remove header'
            >
              <CloseIcon fontSize='small' />
            </IconButton>
          </Box>
        ))}
        <Button
          size='small'
          startIcon={<AddIcon />}
          onClick={addHeader}
        >
          Add Header
        </Button>
      </Box>

      {/* Body editor */}
      {showBody && (
        <Code
          label='Body'
          language='json'
          value={request.body}
          onChange={(val) => setBody(val || '')}
          sx={{ minHeight: 120 }}
          options={{ minimap: { enabled: false }, lineNumbers: 'off', wordWrap: 'on' }}
        />
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant='contained'
          startIcon={
            loading ? (
              <CircularProgress
                size={16}
                color='inherit'
              />
            ) : (
              <PlayIcon />
            )
          }
          onClick={sendRequest}
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Request'}
        </Button>
        {response && (
          <Button
            variant='outlined'
            startIcon={<ClearIcon />}
            onClick={clearResponse}
          >
            Clear
          </Button>
        )}
      </Box>

      {/* Response */}
      {response && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              size='small'
              color={statusColor(response.status)}
              label={`${response.status} ${response.statusText}`}
            />
            <Typography
              variant='body2'
              color='text.secondary'
            >
              {response.timing}ms
            </Typography>
          </Box>
          <Code
            label='Response'
            language={monacoLanguage}
            value={response.body}
            disabled={true}
            sx={{ minHeight: 200 }}
            options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on' }}
          />
        </Box>
      )}
    </Box>
  )
}
