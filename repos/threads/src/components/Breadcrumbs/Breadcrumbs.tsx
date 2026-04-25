import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import { ChevronRight } from '@mui/icons-material'
import { useOrgId, useOrgs } from '@TTH/state/selectors'
import { OrgSelector } from '@TTH/components/Breadcrumbs/OrgSelector'
import { ProjectSelector } from '@TTH/components/Breadcrumbs/ProjectSelector'

const Container = styled(Box)`
  gap: 0.5;
  display: flex;
  align-items: center;
`

const SeparatorIcon = styled(ChevronRight)(({ theme }) => {
  return `
    font-size: 18px;
    margin-left: ${theme.gutter.qpx};
    margin-right: ${theme.gutter.qpx};
    color: ${theme.palette.text.disabled};
  `
})

export const Breadcrumbs = () => {
  const [orgs] = useOrgs()
  const [orgId] = useOrgId()

  if (!orgs.length) return null

  return (
    <Container>
      <OrgSelector />
      {orgId && (
        <>
          <SeparatorIcon />
          <ProjectSelector />
        </>
      )}
    </Container>
  )
}
