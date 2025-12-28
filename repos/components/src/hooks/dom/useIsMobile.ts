import useMediaQuery from '@mui/material/useMediaQuery'

export const useIsMobile = () => {
  const isMobile = useMediaQuery(`(max-width: 66rem)`)
  return isMobile
}
