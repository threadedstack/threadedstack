import { colors } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { Terminal, FolderOutlined } from '@mui/icons-material'
import { useProjects, useSandboxes, useOrgId } from '@TTH/state/selectors'
import { OpenSessionStrip } from '@TTH/components/SessionTabs/OpenSessionStrip'
import { useTheme, useMediaQuery, Box, Container, Typography } from '@mui/material'

export type THome = {}

export const Home = (props: THome) => {
  const theme = useTheme()
  const [orgId] = useOrgId()
  const [projects] = useProjects()
  const [sandboxes] = useSandboxes()
  const isMobile = useMediaQuery(theme.breakpoints.down(`md`))

  return (
    <Page className='tdsk-home-page'>
      {isMobile && <OpenSessionStrip />}
      <Container
        maxWidth='sm'
        disableGutters
      >
        <Box
          sx={{
            gap: 2,
            px: 2,
            minHeight: 300,
            display: `flex`,
            textAlign: `center`,
            alignItems: `center`,
            flexDirection: `column`,
            justifyContent: `center`,
          }}
        >
          <Terminal sx={{ fontSize: 48, color: colors.primary.main, opacity: 0.5 }} />
          <Typography
            variant='h6'
            sx={{ fontWeight: 500 }}
          >
            {orgId ? `Select a project or sandbox` : `Select an organization`}
          </Typography>
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ maxWidth: 400 }}
          >
            {orgId
              ? `Choose a project or sandbox from the sidebar to view details, manage configurations, or start a session.`
              : `Pick an organization from the sidebar to view your projects and sandboxes.`}
          </Typography>
          {orgId && (
            <Box
              sx={{
                display: `flex`,
                gap: 3,
                mt: 1,
              }}
            >
              <Box
                sx={{
                  display: `flex`,
                  alignItems: `center`,
                  gap: 0.75,
                }}
              >
                <FolderOutlined sx={{ fontSize: 18, color: `text.secondary` }} />
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  {projects.length} {projects.length === 1 ? `project` : `projects`}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: `flex`,
                  alignItems: `center`,
                  gap: 0.75,
                }}
              >
                <Terminal sx={{ fontSize: 18, color: `text.secondary` }} />
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  {sandboxes.length} {sandboxes.length === 1 ? `sandbox` : `sandboxes`}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Container>
    </Page>
  )
}

export default Home
