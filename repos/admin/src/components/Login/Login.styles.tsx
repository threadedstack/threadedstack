import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { styled, alpha } from '@mui/material/styles'
import { Text, grey, colors, TSIcon, gutter, LoadingButton } from '@tdsk/components'

// --- Layout ---

export const LoginContainer = styled(Box)`
  flex: 1;
  width: 100vw;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background-color: ${grey[900]};
`

// --- Brand Panel ---

export const BrandGlow = styled(Box)`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    radial-gradient(ellipse at 30% 50%, rgba(51,112,222,0.08) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 70%, rgba(51,112,222,0.05) 0%, transparent 50%);
`

export const BrandBlob = styled(Box)`
  position: absolute;
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
  animation: heroFloat 20s ease-in-out infinite;

  @keyframes heroFloat {
    0%, 100% { transform: translate(0, 0); }
    33% { transform: translate(30px, -20px); }
    66% { transform: translate(-20px, 15px); }
  }
`

export const BrandLogo = styled(TSIcon)`
  width: 56px;
  height: 56px;
  fill: ${colors.primary.main};
  margin-bottom: ${gutter.px};
`

export const BrandHeadline = styled(Text)`
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin-bottom: ${gutter.hpx};
  background: linear-gradient(135deg, #3370DE, #6B9BEA);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`

export const BrandSubtitle = styled(Text)`
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: ${gutter.mpx};
`

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

export const LoginStack = styled(Stack)(({ theme }) => {
  return `
    display: flex;
    width: 100%;
    align-items: stretch;
    justify-content: center;
    padding: ${gutter.hpx} 0px;
    gap: ${gutter.tpx};
  `
})

export const BtnSection = styled(Box)`
  display: flex;
  width: 100%;
`

// --- Provider Buttons ---

export const GgLoginButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    height: 44px;
    color: rgba(255, 255, 255, 0.87);
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: none;
    border-radius: ${theme.dims.border.smpx};
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.18);
    }

    &:disabled {
      opacity: 0.6;
    }
  `
})

export const GhLoginButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    height: 44px;
    color: rgba(255, 255, 255, 0.87);
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: none;
    border-radius: ${theme.dims.border.smpx};
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.18);
    }

    &:disabled {
      opacity: 0.6;
    }
  `
})

export const GlLoginButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    height: 44px;
    color: rgba(255, 255, 255, 0.87);
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: none;
    border-radius: ${theme.dims.border.smpx};
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.18);
    }

    &:disabled {
      opacity: 0.6;
    }
  `
})

export const VrLoginButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    height: 44px;
    color: rgba(255, 255, 255, 0.87);
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: none;
    border-radius: ${theme.dims.border.smpx};
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.18);
    }

    &:disabled {
      opacity: 0.6;
    }
  `
})

// --- Misc ---

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

export const ErrorText = styled(Text)`
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
`

export const EmailFormContainer = styled(`form`)`
  display: flex;
  flex-direction: column;
  gap: ${gutter.px};
  width: 100%;

  .MuiInputBase-root {
    color: rgba(255, 255, 255, 0.87);
  }
  .MuiOutlinedInput-notchedOutline {
    border-color: rgba(255, 255, 255, 0.2);
  }
  .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline {
    border-color: rgba(255, 255, 255, 0.4);
  }
  .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline {
    border-color: ${colors.primary.main};
  }
  .MuiInputLabel-root {
    color: rgba(255, 255, 255, 0.5);
  }
  .MuiInputLabel-root.Mui-focused {
    color: ${colors.primary.main};
  }
  .MuiTypography-root {
    color: rgba(255, 255, 255, 0.5);
  }
  .MuiLink-root {
    color: #6B9BEA;
  }
`

export const EmailFormButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    height: 40px;
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: none;
    color: #fff;
    border-radius: ${theme.dims?.border?.smpx || '6px'};
    background: linear-gradient(135deg, #3370DE, #4a8cf0);
    transition: all 0.15s ease;

    &:hover {
      filter: brightness(0.92);
    }

    &:disabled {
      opacity: 0.6;
    }
  `
})
