import type { Function as FunctionModel } from '@tdsk/domain'

import { useState } from 'react'
import { Code } from '@TAF/components/Code/Code'
import { functionsApi } from '@TAF/services/functionsApi'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { Box, Chip, Button, Typography, CircularProgress } from '@mui/material'
import { PlayArrow as PlayIcon, ClearAll as ClearIcon } from '@mui/icons-material'

export type TFunctionTestPanel = {
  orgId: string
  projectId: string
  func: FunctionModel
}

export const FunctionTestPanel = (props: TFunctionTestPanel) => {
  const { func, orgId, projectId } = props

  const [input, setInput] = useState(`{}`)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<{
    result: string
    logs: string
    durationMs: number
    error?: string
  } | null>(null)

  const onInvoke = async () => {
    let parsedInput: Record<string, any>
    try {
      parsedInput = input.trim() ? JSON.parse(input) : {}
    } catch {
      setError(`Input must be valid JSON`)
      return
    }

    setError(null)
    setLoading(true)

    const resp = await functionsApi.invoke(orgId, projectId, func.id, parsedInput)

    setLoading(false)

    if (resp.error || !resp.data) {
      setError(`Failed to invoke function. Please try again.`)
      return
    }

    setOutput({
      logs: resp.data.logs || ``,
      durationMs: resp.data.durationMs,
      error: resp.data.error,
      result: JSON.stringify(resp.data.result ?? null, null, 2),
    })
  }

  const onClear = () => {
    setOutput(null)
    setError(null)
  }

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
      {error && (
        <ErrorAlert
          message={error}
          onClose={() => setError(null)}
        />
      )}

      <Code
        label='Input'
        value={input}
        language='json'
        sx={{ minHeight: 120 }}
        onChange={(val) => setInput(val || ``)}
        options={{ minimap: { enabled: false }, lineNumbers: `off`, wordWrap: `on` }}
      />

      <Box sx={{ display: `flex`, gap: 1, justifyContent: `flex-end` }}>
        {output && (
          <Button
            variant='outlined'
            onClick={onClear}
            startIcon={<ClearIcon />}
          >
            Clear
          </Button>
        )}
        <Button
          variant='contained'
          onClick={onInvoke}
          disabled={loading}
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
        >
          {loading ? `Invoking...` : `Invoke`}
        </Button>
      </Box>

      {output && (
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
            <Chip
              size='small'
              color={output.error ? `error` : `success`}
              label={output.error ? `Error` : `Success`}
            />
            <Typography
              variant='body2'
              color='text.secondary'
            >
              {output.durationMs}ms
            </Typography>
          </Box>

          {output.error && <ErrorAlert message={output.error} />}

          <Code
            label='Result'
            disabled={true}
            value={output.result}
            language='json'
            sx={{ minHeight: 160 }}
            options={{ readOnly: true, minimap: { enabled: false }, wordWrap: `on` }}
          />

          <Code
            label='Logs'
            disabled={true}
            value={output.logs}
            language='plaintext'
            sx={{ minHeight: 100 }}
            options={{ readOnly: true, minimap: { enabled: false }, wordWrap: `on` }}
          />
        </Box>
      )}
    </Box>
  )
}
