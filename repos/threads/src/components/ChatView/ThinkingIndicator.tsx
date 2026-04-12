import type { TParsedEvent } from '@tdsk/domain'

import { Box, keyframes } from '@mui/material'

const bounce = keyframes`
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
`

export type TThinkingIndicator = {
  event: Extract<TParsedEvent, { type: 'thinking' }>
}

export const ThinkingIndicator = (_props: TThinkingIndicator) => {
  return (
    <Box
      display='flex'
      justifyContent='flex-start'
      gap={0.75}
      px={2}
      py={1}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 8,
            height: 8,
            borderRadius: `50%`,
            backgroundColor: `text.disabled`,
            animation: `${bounce} 1.4s ease-in-out ${i * 0.16}s infinite both`,
          }}
        />
      ))}
    </Box>
  )
}
