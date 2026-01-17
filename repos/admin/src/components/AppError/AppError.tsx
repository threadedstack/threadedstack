import Box from '@mui/material/Box'
import { Text } from '@tdsk/components'
import { styled } from '@mui/material/styles'
import NotInterestedIcon from '@mui/icons-material/NotInterested'

export const AppErrorContainer = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark'
  const { grey } = theme.palette.colors
  const color = isDark ? grey[700] : grey[500]

  return `
    display: flex;
    color: ${color};
    font-weight: bold;
    align-items: center;
    justify-content: center;
    padding: ${theme.gutter.dpx};
  `
})

export const AppErrorIcon = styled(NotInterestedIcon)(({ theme }) => {
  return `
    opacity: 0.75;
    font-size: 22px;
    color: ${theme.palette.colors.states.danger};
  `
})

export const AppErrorText = styled(Text)(({ theme }) => {
  return `
    font-size: 18px;
    font-weight: bold;
    margin-left: ${theme.gutter.hpx};
    opacity: 0.75;
  `
})

export type TAppError = {
  error?: Error
  message?: string
}

export const AppError = (props: TAppError) => {
  const { message = `An internal error occurred!`, error } = props

  return (
    <AppErrorContainer className='prism-app-error-container'>
      <AppErrorIcon className='prism-app-error-icon' />
      <AppErrorText className='prism-app-error-text'>
        {error?.message ?? message}
      </AppErrorText>
    </AppErrorContainer>
  )
}
