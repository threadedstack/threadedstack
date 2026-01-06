import { colors } from '@TSC/theme/colors'
import { cls } from '@keg-hub/jsutils/cls'
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import { useMemo } from 'react'

export type TLoadingDots = {
  id?: string
  size?: number
  className?: string
}

export const LoadingContainer = styled(Box)(({ theme }) => {
  return `
    display: flex;
    justify-content: center;
    & > div {
      border-radius: 50%;
      background-color: ${colors.primary.main};
      animation: tdsk-loading-dots 0.6s infinite alternate;
    }
  `
})

const LoadingDots = (props: TLoadingDots) => {
  const { id, size = 8, className } = props

  const style = useMemo(() => {
    return {
      width: `${size}px`,
      height: `${size}px`,
      margin: `${size / 6}px ${size / 3}px`,
    }
  }, [size])

  return (
    <LoadingContainer
      id={id}
      className={cls(`tdsk-loading-dots`, className)}
    >
      <style>{`
        @keyframes tdsk-loading-dots {
          to {
            opacity: 0.1;
            transform: translateY(-${size}px);
          }
        }

        .tdsk-loading-dots > div:nth-child(2) {
          animation-delay: 0.2s;
        }

        .tdsk-loading-dots > div:nth-child(3) {
          animation-delay: 0.4s;
        }
      `}</style>
      <Box sx={style} />
      <Box sx={style} />
      <Box sx={style} />
    </LoadingContainer>
  )
}
export default LoadingDots
