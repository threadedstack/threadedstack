import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { styled, alpha } from '@mui/material/styles'
import { Text } from '../Text'
import { TSIcon } from '../Icons/TSIcon'
import { gutter } from '../../theme/gutter'
import { LoadingButton } from '../Buttons/LoadingButton'

export const LoginContainer = styled(Box)(({ theme }) => {
  return `
    flex: 1;
    width: 100vw;
    display: flex;
    overflow: hidden;
    min-height: 100vh;
    position: relative;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    background-color: ${theme.palette.background.default};
  `
})

export const BrandGlow = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark'
  return `
    inset: 0;
    z-index: 0;
    position: absolute;
    pointer-events: none;
    background-image: ${
      isDark
        ? `radial-gradient(ellipse at 30% 50%, rgba(51,112,222,0.08) 0%, transparent 60%),
           radial-gradient(ellipse at 80% 70%, rgba(51,112,222,0.05) 0%, transparent 50%)`
        : `radial-gradient(ellipse at 25% 40%, rgba(51,112,222,0.07) 0%, transparent 55%),
           radial-gradient(ellipse at 80% 65%, rgba(51,112,222,0.06) 0%, transparent 50%)`
    };
  `
})

export const BrandBlob1 = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark'
  return `
    position: absolute;
    border-radius: 50%;
    z-index: 0;
    pointer-events: none;
    width: 400px;
    height: 400px;
    top: 10%;
    left: 5%;
    background: radial-gradient(circle, rgba(51,112,222,${isDark ? '0.06' : '0.08'}) 0%, transparent ${isDark ? '70%' : '65%'});
    animation: heroFloat1 18s ease-in-out infinite;

    @keyframes heroFloat1 {
      0% { transform: translate(0, 0); }
      15% { transform: translate(120px, 40px); }
      35% { transform: translate(250px, -30px); }
      55% { transform: translate(180px, 120px); }
      75% { transform: translate(50px, 80px); }
      100% { transform: translate(0, 0); }
    }
  `
})

export const BrandBlob2 = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark'
  return `
    position: absolute;
    border-radius: 50%;
    z-index: 0;
    pointer-events: none;
    width: 300px;
    height: 300px;
    bottom: 15%;
    right: 10%;
    background: radial-gradient(circle, rgba(51,112,222,${isDark ? '0.04' : '0.06'}) 0%, transparent ${isDark ? '70%' : '65%'});
    animation: heroFloat2 22s ease-in-out infinite;

    @keyframes heroFloat2 {
      0% { transform: translate(0, 0); }
      20% { transform: translate(-100px, -60px); }
      40% { transform: translate(-200px, 30px); }
      60% { transform: translate(-120px, -100px); }
      80% { transform: translate(-50px, -40px); }
      100% { transform: translate(0, 0); }
    }
  `
})

export const BrandLogo = styled(TSIcon)(({ theme }) => {
  return `
    width: 56px;
    height: 56px;
    margin-bottom: ${gutter.px};
    fill: ${theme.palette.primary.main};
  `
})

export const BrandHeadline = styled(Text)(({ theme }) => {
  return `
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.02em;
    margin-bottom: ${gutter.hpx};
    background: ${theme.palette.colors.gradients.headline};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  `
})

export const BrandSubtitle = styled(Text)(({ theme }) => {
  return `
    font-size: 0.875rem;
    font-weight: 400;
    line-height: 1.6;
    color: ${theme.palette.text.secondary};
    margin-bottom: ${gutter.mpx};
  `
})

// --- Form Card ---

export const LoginContent = styled(Box)`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 90%;
  min-width: 420px;
  max-width: 460px;

  @media (max-width: 600px) {
    min-width: 320px;
    width: 95%;
  }
`

export const LoginMainContainer = styled(Box)`
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
`

export const LoginStack = styled(Stack)`
  display: flex;
  width: 100%;
  align-items: stretch;
  justify-content: center;
  padding: ${gutter.hpx} 0px;
  gap: ${gutter.tpx};
`

export const BtnSection = styled(Box)`
  display: flex;
  width: 100%;
`

export const ProviderLoginButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    height: 44px;
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: none;
    transition: all 0.15s ease;
    color: ${theme.palette.text.primary};
    border-radius: ${theme.dims.border.smpx};
    border: 1px solid ${theme.palette.divider};
    background: ${alpha(theme.palette.text.primary, 0.04)};

    &:hover {
      background: ${alpha(theme.palette.text.primary, 0.08)};
      border-color: ${alpha(theme.palette.text.primary, 0.18)};
    }

    &:disabled {
      opacity: 0.6;
    }
  `
})

export const ErrorSection = styled(Box)(({ theme }) => {
  return `
    display: flex;
    width: 100%;
    flex-direction: column;
    padding: ${gutter.tpx};
    margin-top: ${gutter.px};
    border-radius: ${theme.dims.border.smpx};
    background: ${alpha(theme.palette.colors.states.danger, 0.12)};
    border: 1px solid ${alpha(theme.palette.colors.states.danger, 0.3)};
  `
})

export const ErrorTitle = styled(Text)(({ theme }) => {
  return `
    font-size: 0.875rem;
    font-weight: 600;
    color: ${theme.palette.colors.states.danger};
    margin-bottom: ${gutter.qpx};
  `
})

export const ErrorText = styled(Text)(({ theme }) => {
  return `
    line-height: 1.5;
    font-size: 0.8125rem;
    color: ${theme.palette.text.secondary};
  `
})

export const EmailFormContainer = styled(`form`)(({ theme }) => {
  return `
    display: flex;
    flex-direction: column;
    gap: ${gutter.px};
    width: 100%;

    .MuiInputBase-root {
      color: ${theme.palette.text.primary};
    }
    .MuiOutlinedInput-notchedOutline {
      border-color: ${theme.palette.divider};
    }
    .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline {
      border-color: ${alpha(theme.palette.text.primary, 0.4)};
    }
    .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline {
      border-color: ${theme.palette.primary.main};
    }
    .MuiTypography-root {
      color: ${theme.palette.text.secondary};
    }
    .MuiLink-root {
      color: ${theme.palette.primary.light};
    }
  `
})

export const EmailFormButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    height: 40px;
    color: #fff;
    font-weight: 600;
    text-transform: none;
    font-size: 0.8125rem;
    transition: all 0.15s ease;
    border-radius: ${theme.dims?.border?.smpx || `6px`};
    background: ${theme?.palette?.colors?.gradients?.button};

    &:hover {
      filter: brightness(0.92);
    }

    &:disabled {
      opacity: 0.6;
    }
  `
})
