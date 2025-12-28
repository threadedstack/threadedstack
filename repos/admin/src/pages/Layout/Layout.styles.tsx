import { Box } from '@mui/material'
import { styled } from '@mui/material/styles'


export const LayoutContainer = styled(Box)(({ theme }) => {
  return `
    width: 100vw;
    height: 100vh;
    display: flex;
    overflow-x: hidden;
    flex-direction: column;
    max-height: -webkit-fill-available;
    background-color: ${theme.palette.background.default};
  `
})

export const LayoutContent = styled(Box)`
  width: 100vw;
  height: 100vh;
  display: flex;
  overflow-x: hidden;
  max-height: -webkit-fill-available;
`
