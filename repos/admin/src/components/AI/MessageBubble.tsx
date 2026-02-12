import type { TChatMessage } from '@TAF/hooks/chat/useAgentChat'

import { Box, Typography } from '@mui/material'
import { Person as PersonIcon, SmartToy as AssistantIcon } from '@mui/icons-material'
import { ToolCallDisplay } from '@TAF/components/AI/ToolCallDisplay'

export type TMessageBubble = {
  message: TChatMessage
  isStreaming?: boolean
}

export const MessageBubble = (props: TMessageBubble) => {
  const { message, isStreaming } = props
  const isUser = message.role === `user`

  return (
    <Box
      sx={{
        display: `flex`,
        gap: 1.5,
        alignItems: `flex-start`,
        flexDirection: isUser ? `row-reverse` : `row`,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: `50%`,
          display: `flex`,
          alignItems: `center`,
          justifyContent: `center`,
          bgcolor: isUser ? `primary.main` : `grey.700`,
          color: `white`,
          flexShrink: 0,
          mt: 0.5,
        }}
      >
        {isUser ? (
          <PersonIcon sx={{ fontSize: 18 }} />
        ) : (
          <AssistantIcon sx={{ fontSize: 18 }} />
        )}
      </Box>

      <Box
        sx={{
          maxWidth: `75%`,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: 2,
            bgcolor: isUser ? `primary.main` : `background.paper`,
            color: isUser ? `primary.contrastText` : `text.primary`,
            border: isUser ? `none` : 1,
            borderColor: `divider`,
          }}
        >
          {message.text ? (
            <Typography
              variant='body2'
              sx={{ whiteSpace: `pre-wrap`, wordBreak: `break-word` }}
            >
              {message.text}
              {isStreaming && !isUser && (
                <Box
                  component='span'
                  sx={{
                    display: `inline-block`,
                    width: 6,
                    height: 14,
                    bgcolor: `text.primary`,
                    ml: 0.5,
                    animation: `blink 1s step-end infinite`,
                    verticalAlign: `text-bottom`,
                    '@keyframes blink': {
                      '50%': { opacity: 0 },
                    },
                  }}
                />
              )}
            </Typography>
          ) : (
            isStreaming &&
            !isUser && (
              <Typography
                variant='body2'
                color='text.secondary'
                sx={{ fontStyle: `italic` }}
              >
                Thinking...
              </Typography>
            )
          )}
        </Box>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {message.toolCalls.map((tc) => (
              <ToolCallDisplay
                key={tc.id}
                toolCall={tc}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
