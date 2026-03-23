import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

export const LoginContainer = styled(Box)(({ theme }) => {
  return `
    width: 100vw;
    height: 100vh;
    display: flex;
    overflow-x: hidden;
    max-height: -webkit-fill-available;
    background-color: ${theme.palette.background.default};
  `
})
