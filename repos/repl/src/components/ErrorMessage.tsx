import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'
import { toFriendlyError } from '@TRL/constants/errors'

type ErrorMessageProps = {
  error?: Error
  message?: string
  suggestion?: string
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
      marginY={1}
      flexDirection="column"
    >
      <Text>
        {themed('error', '✗')} {displayMessage}
      </Text>
      {displaySuggestion && <Text> {themed('muted', displaySuggestion)}</Text>}
    </Box>
  )
}
