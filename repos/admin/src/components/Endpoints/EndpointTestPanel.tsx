import { useState } from 'react'
import type { Endpoint } from '@tdsk/domain'
import { EEndpointType } from '@tdsk/domain'
import {
  Box,
  Chip,
  Menu,
  Button,
  MenuItem,
  TextField,
  Typography,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  ClearAll as ClearIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon,
} from '@mui/icons-material'
import { Code } from '@TAF/components/Code/Code'
import { useCopyToClipboard } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { generateSnippet } from '@TAF/utils/endpoints/snippets'
import type { TSnippetFormat } from '@TAF/utils/endpoints/snippets'
import {
  useEndpointTest,
  contentTypeToLanguage,
} from '@TAF/hooks/endpoints/useEndpointTest'
import type { TBodyType } from '@TAF/hooks/endpoints/useEndpointTest'

const bodylessMethods = ['GET', 'HEAD']

const statusColor = (status: number): 'success' | 'warning' | 'error' => {
  if (status < 300) return 'success'
  if (status < 400) return 'warning'
  return 'error'
}

const resolveMethod = (endpoint: Endpoint): string => {
  if (endpoint.type === EEndpointType.proxy) return endpoint.method || 'GET'
  return 'POST'
}

const snippetFormats: { label: string; value: TSnippetFormat }[] = [
  { label: 'cURL', value: 'curl' },
  { label: 'fetch', value: 'fetch' },
  { label: 'axios', value: 'axios' },
  { label: 'HTTPie', value: 'httpie' },
]

export type TEndpointTestPanel = {
  endpoint: Endpoint
  projectId: string
}

export const EndpointTestPanel = (props: TEndpointTestPanel) => {
  const { endpoint, projectId } = props
  const method = resolveMethod(endpoint)

  const {
    error,
    setBody,
    loading,
    request,
    response,
    bodyType,
    addHeader,
    requestUrl,
    queryParams,
    sendRequest,
    bodyLanguage,
    removeHeader,
    updateHeader,
    addQueryParam,
    clearResponse,
    monacoLanguage,
    changeBodyType,
    removeQueryParam,
    updateQueryParam,
  } = useEndpointTest({ method, projectId, endpointId: endpoint.id })

  const { onCopyToClipBoard } = useCopyToClipboard()
  const [snippetAnchorEl, setSnippetAnchorEl] = useState<null | HTMLElement>(null)

  const showBody = !bodylessMethods.includes(request.method.toUpperCase())

  const headersObj = () => {
    const obj: Record<string, string> = {}
    for (const h of request.headers) {
      if (h.key.trim()) obj[h.key.trim()] = h.value
    }
    return obj
  }

  const onCopySnippet = (format: TSnippetFormat) => {
    const snippet = generateSnippet(format, {
      url: requestUrl,
      headers: headersObj(),
      method: request.method.toUpperCase(),
      body: showBody && request.body ? request.body : undefined,
    })
    onCopyToClipBoard(snippet)
    setSnippetAnchorEl(null)
  }

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
        size='small'
        variant='outlined'
        sx={{ alignSelf: 'flex-start' }}
        label={`Method: ${request.method.toUpperCase()}`}
      />

      {/* URL bar */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size='small'
          value={requestUrl}
          sx={{ flex: 1, '& .MuiInputBase-root': { bgcolor: 'background.paper' } }}
          slotProps={{
            input: {
              readOnly: true,
              sx: { fontFamily: 'monospace', fontSize: '0.85rem' },
            },
          }}
        />
        <IconButton
          size='small'
          aria-label='Copy URL'
          onClick={() => onCopyToClipBoard(requestUrl)}
        >
          <CopyIcon fontSize='small' />
        </IconButton>
      </Box>

      {/* Query Params */}
      <Box>
        <Typography
          variant='subtitle2'
          sx={{ mb: 1 }}
        >
          Query Parameters
        </Typography>
        {queryParams.map((param, index) => (
          <Box
            key={index}
            sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
          >
            <TextField
              size='small'
              placeholder='Key'
              value={param.key}
              onChange={(e) => updateQueryParam(index, 'key', e.target.value)}
              sx={{ flex: 1, '& .MuiInputBase-root': { bgcolor: 'background.paper' } }}
            />
            <TextField
              size='small'
              placeholder='Value'
              value={param.value}
              onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
              sx={{ flex: 2, '& .MuiInputBase-root': { bgcolor: 'background.paper' } }}
            />
            <IconButton
              size='small'
              aria-label='Remove query parameter'
              onClick={() => removeQueryParam(index)}
            >
              <CloseIcon fontSize='small' />
            </IconButton>
          </Box>
        ))}
        <Button
          size='small'
          startIcon={<AddIcon />}
          onClick={addQueryParam}
        >
          Add Parameter
        </Button>
      </Box>

      {/* Headers */}
      <Box>
        <Typography
          sx={{ mb: 1 }}
          variant='subtitle2'
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
              aria-label='Remove header'
              onClick={() => removeHeader(index)}
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
        <Box>
          <ToggleButtonGroup
            exclusive
            size='small'
            sx={{ mb: 1 }}
            value={bodyType}
            onChange={(_, val) => val && changeBodyType(val as TBodyType)}
          >
            <ToggleButton value='json'>JSON</ToggleButton>
            <ToggleButton value='form'>Form</ToggleButton>
            <ToggleButton value='raw'>Raw</ToggleButton>
          </ToggleButtonGroup>
          <Code
            label='Body'
            value={request.body}
            language={bodyLanguage}
            sx={{ minHeight: 120 }}
            onChange={(val) => setBody(val || '')}
            options={{ minimap: { enabled: false }, lineNumbers: 'off', wordWrap: 'on' }}
          />
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        {response && (
          <Button
            variant='outlined'
            onClick={clearResponse}
            startIcon={<ClearIcon />}
          >
            Clear
          </Button>
        )}
        <Button
          variant='outlined'
          startIcon={<CodeIcon />}
          onClick={(e) => setSnippetAnchorEl(e.currentTarget)}
        >
          Copy as
        </Button>
        <Menu
          anchorEl={snippetAnchorEl}
          open={Boolean(snippetAnchorEl)}
          onClose={() => setSnippetAnchorEl(null)}
        >
          {snippetFormats.map((fmt) => (
            <MenuItem
              key={fmt.value}
              onClick={() => onCopySnippet(fmt.value)}
            >
              {fmt.label}
            </MenuItem>
          ))}
        </Menu>
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
            disabled={true}
            value={response.body}
            sx={{ minHeight: 200 }}
            language={monacoLanguage}
            options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on' }}
          />
        </Box>
      )}
    </Box>
  )
}
