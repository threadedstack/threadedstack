import type { NotificationCountProps } from '@TSC/types'
import type { Theme } from '@mui/material'

import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useTheme from '@mui/material/styles/useTheme'

const getInputWidth = (count: string | number, hasArrow?: boolean) => {
  const countString = count.toString()
  let contentWidth = countString.length * 8 + (hasArrow ? 22 : 0)
  if (countString.includes('.') || countString.includes(',')) contentWidth -= 6
  return `${contentWidth}px`
}

const NotificationCount = ({ count, inputProps }: NotificationCountProps) => {
  const theme = useTheme()

  if (!count) return null

  if (!inputProps)
    return (
      <Box
        display='flex'
        alignItems='center'
        className='notification-count'
        sx={{
          borderRadius: '6px',
          padding: '4px 8px',
          backgroundColor: theme.palette.mode === 'light' ? 'grey.100' : 'grey.800',
        }}
      >
        <Typography
          className='notification-count'
          color='text.secondary'
          sx={{
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {count}
        </Typography>
      </Box>
    )

  return (
    <TextField
      id={inputProps.id}
      sx={{
        borderRadius: '6px',
        backgroundColor: (theme: Theme) =>
          theme.palette.mode === 'light' ? 'grey.100' : 'grey.800',
        '& fieldset': { border: 'none' },
      }}
      value={count}
      onChange={inputProps.onChange}
      onMouseUp={inputProps.onMouseUp}
      onMouseDown={inputProps.onMouseDown}
      slotProps={{
        htmlInput: {
          type: 'number',
          max: inputProps.max,
          min: inputProps.min,
          step: inputProps.step || 1,
          sx: {
            width: getInputWidth(count),
            padding: (theme: Theme) => theme.spacing(0.5, 1),
            fontSize: '12px',
            fontWeight: 600,
            color: 'text.secondary',
            MozAppearance: 'textfield',
            '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': {
              display: 'none',
            },
            '&:focus': {
              width: getInputWidth(count, true),
              MozAppearance: 'auto',
              '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': {
                display: 'flex',
              },
            },
          },
        },
      }}
    />
  )
}

export { NotificationCount }
