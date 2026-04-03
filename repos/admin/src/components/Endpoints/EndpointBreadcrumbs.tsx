import { ERoutePath } from '@TAF/types'
import { Box, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { ChevronRight } from '@mui/icons-material'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { Link, useParams } from 'react-router'
import { useActiveEndpoint } from '@TAF/state/selectors'

const SeparatorIcon = styled(ChevronRight)(({ theme }) => {
  return `
    font-size: 18px;
    margin-left: ${theme.gutter.qpx};
    margin-right: ${theme.gutter.qpx};
    color: ${theme.palette.text.disabled};
  `
})

const BreadcrumbLink = styled(Link)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textDecoration: `none`,
  fontSize: `0.875rem`,
  [`&:hover`]: {
    color: theme.palette.primary.main,
    textDecoration: `underline`,
  },
}))

const BreadcrumbText = styled(Typography)({
  fontSize: `0.875rem`,
  fontWeight: 500,
}) as typeof Typography

export const EndpointBreadcrumbs = () => {
  const { orgId, projectId } = useParams<{
    orgId: string
    projectId: string
  }>()
  const [endpoint] = useActiveEndpoint()

  const endpointsPath = buildNavRoute({ orgId, projectId }, ERoutePath.ProjectEndpoints)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
      <BreadcrumbLink to={endpointsPath}>Endpoints</BreadcrumbLink>

      <SeparatorIcon />
      <BreadcrumbText color='text.primary'>{endpoint?.name || 'Endpoint'}</BreadcrumbText>
    </Box>
  )
}
