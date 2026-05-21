import type { Project as TProject, Sandbox } from '@tdsk/domain'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import { useParams } from 'react-router'
import Button from '@mui/material/Button'
import { SandboxIcon } from '@tdsk/components'
import IconButton from '@mui/material/IconButton'
import { NotFound } from '@TTH/components/Project/NotFound'
import { EmptyState } from '@TTH/components/EmptyState/EmptyState'
import { formatDate, formatRelativeDate } from '@TTH/utils/formatDate'
import { ProjectSandboxCard } from '@TTH/components/Project/ProjectSandboxCard'
import { Workspaces, Settings, Add, FilterList, Sort } from '@mui/icons-material'
import {
  useProjects,
  useSandboxes,
  useOrgId,
  useOpenSessions,
} from '@TTH/state/selectors'
import { PageHeader, StatStrip, SectionHeader } from '@TTH/components/PagePrimitives'

export const Project = () => {
  const [orgId] = useOrgId()
  const [projects] = useProjects()
  const [sandboxes] = useSandboxes()
  const [openSessions] = useOpenSessions()
  const { projectId } = useParams<{ projectId: string }>()

  const project = useMemo<TProject | undefined>(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  )

  const projectSandboxes = useMemo<Sandbox[]>(() => {
    if (!projectId) return []
    return sandboxes.filter((sb) => sb.projects?.some((p) => p.id === projectId))
  }, [sandboxes, projectId])

  const runningSandboxCount = useMemo(() => {
    const sandboxIds = new Set(projectSandboxes.map((sb) => sb.id))
    const runningSandboxIds = new Set<string>()
    for (const session of openSessions.values()) {
      if (sandboxIds.has(session.sandboxId)) runningSandboxIds.add(session.sandboxId)
    }
    return runningSandboxIds.size
  }, [projectSandboxes, openSessions])

  if (!projectId || !project) return <NotFound />

  return (
    <Box sx={{ width: `100%`, margin: `0 auto`, maxWidth: 960 }}>
      <PageHeader
        eyebrow='Project'
        eyebrowIcon={<Workspaces />}
        title={project.name}
        titleMono
        subtitle={project.description}
        actions={
          <>
            <Button
              disabled
              size='small'
              variant='outlined'
              title='Coming soon'
              startIcon={<Settings />}
            >
              Configure
            </Button>
            <Button
              disabled
              size='small'
              variant='contained'
              title='Coming soon'
              startIcon={<Add />}
            >
              New sandbox
            </Button>
          </>
        }
      />

      <StatStrip
        cells={[
          {
            label: `Environment`,
            value: `-`,
            sans: true,
          },
          {
            label: `Sandboxes`,
            value: `${runningSandboxCount} / ${projectSandboxes.length}`,
            help: `running / total`,
          },
          {
            label: `Members`,
            value: `-`,
            sans: true,
          },
          {
            label: `Language`,
            value: `-`,
            sans: true,
          },
          {
            label: `Updated`,
            value: formatRelativeDate(project.updatedAt),
            sans: true,
          },
          {
            label: `Created`,
            value: formatDate(project.createdAt),
            sans: true,
          },
        ]}
      />

      <SectionHeader
        title='Sandboxes'
        count={projectSandboxes.length}
        actions={
          <>
            <IconButton
              size='small'
              disabled
              title='Coming soon'
            >
              <FilterList sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size='small'
              disabled
              title='Coming soon'
            >
              <Sort sx={{ fontSize: 18 }} />
            </IconButton>
          </>
        }
      />

      {projectSandboxes.length === 0 ? (
        <EmptyState
          icon={<SandboxIcon />}
          title='No sandboxes configured for this project'
        />
      ) : (
        <Box
          sx={{
            display: `grid`,
            gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))`,
            gap: 2,
          }}
        >
          {projectSandboxes.map((sandbox) => (
            <ProjectSandboxCard
              orgId={orgId}
              key={sandbox.id}
              sandbox={sandbox}
              projectId={projectId!}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}
