import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useLocation, Link as RouterLink } from 'react-router'
import { allPages } from '@TAF/utils/docsContent'

const DocsPrevNext = () => {
  const { pathname } = useLocation()
  const idx = allPages.findIndex((p) => p.path === pathname)
  const prev = idx > 0 ? allPages[idx - 1] : null
  const next = idx < allPages.length - 1 ? allPages[idx + 1] : null

  if (!prev && !next) return null

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        mt: 6,
        pt: 3,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {prev ? (
        <Button
          component={RouterLink}
          to={prev.path}
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: 'none' }}
        >
          {prev.label}
        </Button>
      ) : (
        <Box />
      )}
      {next ? (
        <Button
          component={RouterLink}
          to={next.path}
          endIcon={<ArrowForwardIcon />}
          sx={{ textTransform: 'none' }}
        >
          {next.label}
        </Button>
      ) : (
        <Box />
      )}
    </Box>
  )
}

export default DocsPrevNext
