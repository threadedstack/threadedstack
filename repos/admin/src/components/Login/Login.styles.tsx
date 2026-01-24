import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { styled, darken, alpha } from '@mui/material/styles'
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'
import { Text, grey, colors, TSIcon, gutter, LoadingButton } from '@tdsk/components'

export const LoginContainer = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark'
  return `
    flex: 1;
    width: 100vw;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    background: ${
      isDark
        ? `linear-gradient(135deg, ${grey[900]} 0%, ${grey[875]} 50%, ${grey[850]} 100%)`
        : `linear-gradient(135deg, ${grey[25]} 0%, ${grey[10]} 50%, ${grey[5]} 100%)`
    };

    &::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: ${
        isDark
          ? `radial-gradient(circle, ${alpha(colors.primary.main, 0.08)} 0%, transparent 70%)`
          : `radial-gradient(circle, ${alpha(colors.primary.main, 0.05)} 0%, transparent 70%)`
      };
      animation: float 20s ease-in-out infinite;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: -10%;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: ${
        isDark
          ? `radial-gradient(circle, ${alpha(colors.primary[600], 0.06)} 0%, transparent 70%)`
          : `radial-gradient(circle, ${alpha(colors.primary[300], 0.04)} 0%, transparent 70%)`
      };
      animation: float 25s ease-in-out infinite reverse;
    }

    @keyframes float {
      0%, 100% {
        transform: translate(0, 0) scale(1);
      }
      50% {
        transform: translate(-30px, 30px) scale(1.1);
      }
    }
  `
})

export const LoginContent = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark'

  return `
    z-index: 1;
    width: 90%;
    min-width: 450px;
    max-width: 500px;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(20px);
    border-radius: ${theme.dims.border.tpx};
    border: 1px solid ${isDark ? alpha(grey[700], 0.3) : alpha(grey[200], 0.5)};
    background: ${
      isDark
        ? `linear-gradient(180deg, ${alpha(grey[850], 0.95)} 0%, ${alpha(grey[875], 0.98)} 100%)`
        : `linear-gradient(180deg, ${alpha(grey[0], 0.98)} 0%, ${alpha(grey[5], 0.95)} 100%)`
    };

    @media (max-width: 600px) {
      min-width: 320px;
      width: 95%;
    }
  `
})

export const LoginHeader = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark'
  return `
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: center;
    padding: ${gutter.mpx};
    background: ${isDark ? alpha(grey[825], 0.3) : alpha(grey[10], 0.5)};
    border-bottom: 1px solid ${isDark ? alpha(grey[700], 0.2) : alpha(grey[200], 0.3)};
  `
})

export const LoginHeaderText = styled(Text)(({ theme }) => {
  return `
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin-left: ${gutter.tpx};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background: linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary[600]} 100%);
    background-clip: text;
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
    padding: ${gutter.dpx} ${gutter.dpx} ${gutter.size * 2.5}px;
  `
})

export const LoginMainHeader = styled(Box)(({ theme }) => {
  return `
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: ${gutter.hpx};
    padding: 0px 0px ${gutter.tpx};
  `
})

export const LoginMainText = styled(Text)(({ theme }) => {
  return `
    font-size: 18px;
    font-weight: 600;
    color: ${theme.palette.text.primary};
    letter-spacing: -0.3px;
  `
})

export const LoginMainIcon = styled(SecurityOutlinedIcon)(({ theme }) => {
  return `
    padding-right: ${gutter.hpx};
    color: ${colors.primary.main};
    font-size: 24px;
  `
})

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
  width: 80%;
  margin: auto;

  @media (max-width: 500px) {
    width: 100%;
  }
  
`

export const GgLoginButton = styled(LoadingButton)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark'
  return `
    width: 100%;
    height: 52px;
    color: ${grey[0]};
    font-size: 15px;
    font-weight: 600;
    text-transform: none;
    border-radius: ${theme.dims.border.tpx};
    background: #34A853;
    border: 1px solid ${alpha('#fff', 0.1)};
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: translateY(-2px);
      background: ${darken('#34A853', 0.1)};
    }

    &:active {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.6;
      transform: none;
    }
  `
})

export const GhLoginButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    height: 52px;
    color: ${grey[0]};
    font-size: 15px;
    font-weight: 600;
    text-transform: none;
    background: ${darken(`#909692`, 0.2)};
    border-radius: ${theme.dims.border.tpx};
    border: 1px solid ${alpha('#fff', 0.08)};
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: #232925;
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.6;
      transform: none;
    }
  `
})

export const GlLoginButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    height: 52px;
    color: ${grey[0]};
    font-size: 15px;
    font-weight: 600;
    text-transform: none;
    background: #fc6d27;
    border-radius: ${theme.dims.border.tpx};
    border: 1px solid ${alpha('#fff', 0.1)};
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: ${darken('#fc6d27', 0.08)};
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.6;
      transform: none;
    }
  `
})

export const VrLoginButton = styled(LoadingButton)(({ theme }) => {
  return `
    width: 100%;
    height: 52px;
    color: ${grey[0]};
    font-size: 15px;
    font-weight: 600;
    text-transform: none;
    border-radius: ${theme.dims.border.tpx};
    background: #2E2E2E;
    border: 1px solid ${alpha('#fff', 0.08)};
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: #0A0A0A;
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.6;
      transform: none;
    }
  `
})

export const TSLogo = styled(TSIcon)(({ theme }) => {
  return `
    width: 36px;
    height: 36px;
    fill: ${colors.primary.main};
  `
})

export const ErrorSection = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark'
  return `
    display: flex;
    width: 100%;
    flex-direction: column;
    padding: ${gutter.tpx};
    margin-top: ${gutter.px};
    border-radius: ${theme.dims.border.tpx};
    background: ${
      isDark
        ? alpha(theme.palette.colors.states.danger, 0.12)
        : alpha(theme.palette.colors.states.danger, 0.08)
    };
    border: 1px solid ${alpha(theme.palette.colors.states.danger, isDark ? 0.3 : 0.2)};
    animation: slideIn 0.3s ease-out;

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `
})

export const ErrorTitle = styled(Text)(({ theme }) => {
  return `
    font-size: 16px;
    font-weight: 700;
    color: ${theme.palette.colors.states.danger};
    margin-bottom: ${gutter.hpx};
    letter-spacing: -0.2px;
  `
})

export const ErrorText = styled(Text)(({ theme }) => {
  return `
    font-size: 14px;
    color: ${theme.palette.text.secondary};
    line-height: 1.5;
  `
})
