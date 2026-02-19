import React from 'react'
import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'
import { toFriendlyError } from '@TRL/constants/errors'

type ErrorMessageProps = {
  message?: string
  suggestion?: string
  error?: unknown
}

export function ErrorMessage({ message, suggestion, error }: ErrorMessageProps) {
  let displayMessage = message || ''
  let displaySuggestion = suggestion

  if (error && !message) {
    const friendly = toFriendlyError(error)
    displayMessage = friendly.message
    displaySuggestion = friendly.suggestion
  }

  return (
    <Box
      flexDirection="column"
      marginY={1}
    >
      <Text>
        {themed('error', '✗')} {displayMessage}
      </Text>
      {displaySuggestion && <Text> {themed('muted', displaySuggestion)}</Text>}
    </Box>
  )
}
