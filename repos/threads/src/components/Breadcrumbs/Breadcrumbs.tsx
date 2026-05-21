import Box from '@mui/material/Box'
import { useParams } from 'react-router'
import { styled } from '@mui/material/styles'
import { ChevronRight } from '@mui/icons-material'
import { useOrgId, useOrgs } from '@TTH/state/selectors'
import { OrgSelector } from '@TTH/components/Breadcrumbs/OrgSelector'
import { SessionCrumb } from '@TTH/components/Breadcrumbs/SessionCrumb'
import { SandboxCrumb } from '@TTH/components/Breadcrumbs/SandboxCrumb'
import { InstanceCrumb } from '@TTH/components/Breadcrumbs/InstanceCrumb'
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

type TBreadcrumbParams = {
  orgId?: string
  projectId?: string
  sandboxId?: string
  instanceId?: string
  sessionId?: string
}

export const Breadcrumbs = () => {
  const [orgs] = useOrgs()
  const [orgId] = useOrgId()
  const params = useParams<TBreadcrumbParams>()

  if (!orgs.length) return null

  const { sandboxId, instanceId, sessionId, projectId } = params

  return (
    <Container>
      <OrgSelector />
      {orgId && (
        <>
          <SeparatorIcon />
          <ProjectSelector />
        </>
      )}
      {orgId && projectId && sandboxId && (
        <>
          <SeparatorIcon />
          <SandboxCrumb
            sandboxId={sandboxId}
            projectId={projectId}
          />
        </>
      )}
      {orgId && projectId && sandboxId && instanceId && (
        <>
          <SeparatorIcon />
          <InstanceCrumb
            sandboxId={sandboxId}
            projectId={projectId}
            instanceId={instanceId}
          />
        </>
      )}
      {orgId && projectId && sessionId && (
        <>
          <SeparatorIcon />
          <SessionCrumb sessionId={sessionId} />
        </>
      )}
    </Container>
  )
}
