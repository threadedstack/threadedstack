import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { styled, darken } from '@mui/material/styles'
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'
import {
  dims,
  Text,
  grey,
  colors,
  TSIcon,
  gutter,
  LoadingButton,
} from '@tdsk/components'


export const LoginContainer = styled(Box)`
  flex: 1;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
`

export const LoginContent = styled(Box)(({ theme }) => {
  return `
    min-width: 30%;
    box-shadow: ${theme.shadows[1]};
    border-radius: ${dims.border.tpx};
    border: 1px solid ${theme.palette.border.default};
  `
})

export const LoginHeader = styled(Box)(({ theme }) => {
  return `
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: start;
    padding: ${gutter.tpx} ${gutter.px};
  `
})

export const LoginHeaderText = styled(Text)(({ theme }) => {
  return `
    font-size: 26px;
    font-weight: bold;
    margin-left: ${gutter.hpx};
  `
})


export const LoginMainContainer = styled(Box)(({ theme }) => {
  return `
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    padding-top: ${gutter.tpx};
    border-bottom-left-radius: ${dims.border.tpx};
    border-bottom-right-radius: ${dims.border.tpx};
    background-color: ${theme.palette.background.paper};
  `
})

export const LoginMainHeader = styled(Box)(({ theme }) => {
  return `
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${gutter.px} 0px;
  `
})

export const LoginMainText = styled(Text)(({ theme }) => {
  return `
    font-size: 16px;
    font-weight: bold;
  `
})

export const LoginMainIcon = styled(SecurityOutlinedIcon)(({ theme }) => {
  return `
    padding-right: ${gutter.hpx};
  `
})


export const LoginStack = styled(Stack)(({ theme }) => {

  return `
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0px ${gutter.size * 4}px ${gutter.dpx};
  `
})


export const BtnSection = styled(Box)`
  display: flex;
  min-width: 200px;
  padding-top: ${gutter.hpx};
  padding-bottom: ${gutter.hpx};
`

export const GgLoginButton = styled(LoadingButton)(({ theme }) => {

  return `
    width: 100%;
    color: ${grey[0]};
    background-color: #34A853;
    :hover{
      transition:.2s;
      background-color: ${darken('#34A853', 0.3)}
    } 
  `
})


export const GhLoginButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    color: ${grey[0]};
    background-color: #6E7681;
    :hover{
      transition:.2s;
      background-color: ${darken('#6E7681', 0.3)}
    } 
  `
})

export const GlLoginButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    color: ${grey[0]};
    background-color: #fc6d27;
    :hover{
      transition:.2s;
      background-color: ${darken('#fc6d27', 0.3)}
    } 
  `
})


export const TSLogo = styled(TSIcon)(({ theme }) => {
  return `
    width: 32px;
    height: 32px;
    fill: ${colors.primary.main};
  `
})


export const ErrorSection = styled(Box)`
  display: flex;
  min-width: 200px;
  flex-direction: column;
  padding-top: ${gutter.hpx};
  padding-bottom: ${gutter.size * 3}px;
`

export const ErrorTitle = styled(Text)`
  font-size: 18px;
  font-weight: bold;
  color: ${colors.states.danger};
`

export const ErrorText = styled(Text)`
  font-size: 14px;
`