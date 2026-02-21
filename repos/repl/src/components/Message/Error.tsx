import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'
import { toFriendlyError } from '@TRL/constants/errors'

type TErrorMessage = {
  error?: Error
  message?: string
  suggestion?: string
}

export const ErrorMessage = (props: TErrorMessage) => {
  const { message, suggestion, error } = props

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
