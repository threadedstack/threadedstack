import useMediaQuery from '@mui/material/useMediaQuery'

export const useIsMobile = () => {
  return useMediaQuery(`(max-width: 66rem)`)
}
