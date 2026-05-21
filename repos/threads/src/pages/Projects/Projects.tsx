import type { Project, Sandbox, TOrgWithRole } from '@tdsk/domain'

import { nav } from '@TTH/services/nav'
import { useParams } from 'react-router'
import { Avatar } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { useMemo, useCallback } from 'react'
import { EmptyState } from '@TTH/components/EmptyState'
import { selectProject } from '@TTH/actions/projects/selectProject'
import { MonoFont, ProjectBrandColors } from '@TTH/constants/values'
import { formatDate, formatRelativeDate } from '@TTH/utils/formatDate'
import { Box, Chip, Typography, Button, IconButton } from '@mui/material'
import {
  useProjects,
  useSandboxes,
  useActiveOrg,
  useActiveOrgRole,
} from '@TTH/state/selectors'
import {
  StatStrip,
  PageHeader,
  ResourceCard,
  SectionHeader,
} from '@TTH/components/PagePrimitives'
import {
  Add,
  Sort,
  Schedule,
  GridView,
  Settings,
  FilterList,
  Workspaces,
  FolderOutlined,
} from '@mui/icons-material'

const sandboxCountByProject = (sandboxes: Sandbox[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const sb of sandboxes) {
    if (sb.projects?.length) {
      for (const proj of sb.projects) {
        counts.set(proj.id, (counts.get(proj.id) ?? 0) + 1)
      }
    }
  }
  return counts
}

type TProjectCardItem = {
  project: Project
  sandboxCount: number
  onSelect: (projectId: string) => void
}

const getProjectColor = (id: string): string => {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return ProjectBrandColors[Math.abs(hash) % ProjectBrandColors.length]
}

const ProjectCardItem = (props: TProjectCardItem) => {
  const { project, sandboxCount, onSelect } = props
  const brandColor = useMemo(() => getProjectColor(project.id), [project.id])

  const metaRight = useMemo(() => {
    const parts: string[] = []
    parts.push(`${sandboxCount} ${sandboxCount === 1 ? `sandbox` : `sandboxes`}`)
    return parts.join(` · `)
  }, [sandboxCount])

  return (
    <ResourceCard onClick={() => onSelect(project.id)}>
      {/* Top row: icon + name */}
      <Box sx={{ display: `flex`, alignItems: `center`, gap: `10px` }}>
        <Workspaces sx={{ fontSize: 20, color: brandColor }} />
        <Typography
          noWrap
          sx={{
            fontFamily: MonoFont,
            fontSize: `14px`,
            fontWeight: 600,
            flex: 1,
            minWidth: 0,
          }}
        >
          {project.name}
        </Typography>
      </Box>

      {/* Description */}
      {project.description && (
        <Typography
          noWrap
          sx={{
            fontSize: `12px`,
            color: `text.secondary`,
            lineHeight: 1.4,
          }}
        >
          {project.description}
        </Typography>
      )}

      {/* Chips + metadata */}
      <Box sx={{ display: `flex`, alignItems: `center`, gap: `6px`, flexWrap: `wrap` }}>
        {project.branch && (
          <Chip
            size='small'
            label={project.branch}
            sx={{
              height: 20,
              fontSize: 11,
              fontFamily: MonoFont,
              bgcolor: `background.default`,
              border: `1px solid`,
              borderColor: `divider`,
              '& .MuiChip-label': { px: `6px` },
            }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography
          sx={{
            fontSize: `11px`,
            color: `text.secondary`,
          }}
        >
          {metaRight}
        </Typography>
      </Box>

      {/* Bottom row: updated date */}
      <Box
        sx={{
          display: `flex`,
          alignItems: `center`,
          gap: `6px`,
          pt: `8px`,
          borderTop: `1px solid`,
          borderColor: `divider`,
        }}
      >
        <Schedule sx={{ fontSize: 14, color: `text.secondary` }} />
        <Typography sx={{ fontSize: `11px`, color: `text.secondary` }}>
          Updated {formatRelativeDate(project.updatedAt)}
        </Typography>
      </Box>
    </ResourceCard>
  )
}

const ProjectsEmptyState = () => (
  <EmptyState
    icon={<FolderOutlined />}
    title='No projects found for this organization'
  />
)

const OrgAvatar = (props: { name?: string; id: string }) => (
  <Box sx={{ display: `inline-flex`, mr: `12px`, verticalAlign: `middle` }}>
    <Avatar
      name={props.name || ``}
      identifier={props.id}
      size='lg'
      square
    />
  </Box>
)

const Projects = () => {
  const { orgId } = useParams<{ orgId: string }>()
  const [projects] = useProjects()
  const [sandboxes] = useSandboxes()
  const [activeOrg] = useActiveOrg()
  const [activeOrgRole] = useActiveOrgRole()

  const sbCounts = useMemo(() => sandboxCountByProject(sandboxes), [sandboxes])

  const onSelect = useCallback(
    (projectId: string) => {
      selectProject(projectId)
      nav.project(orgId, projectId)
    },
    [orgId]
  )

  if (!orgId) return null

  const orgName = activeOrg?.name ?? `Organization`
  const role =
    activeOrgRole ?? (activeOrg as TOrgWithRole | undefined)?.userRole ?? undefined

  const subtitle = [role].filter(Boolean).join(` · `)

  return (
    <Page className='tdsk-projects-page'>
      <Box sx={{ width: `100%`, margin: `0 auto`, maxWidth: 900 }}>
        <PageHeader
          eyebrow='Organization'
          eyebrowIcon={<GridView />}
          title={
            <Box
              component='span'
              sx={{ display: `inline-flex`, alignItems: `center` }}
            >
              <OrgAvatar
                name={orgName}
                id={orgId}
              />
              {orgName}
            </Box>
          }
          subtitle={subtitle || undefined}
          actions={
            <>
              <Button
                disabled
                size='small'
                variant='outlined'
                title='Coming soon'
                startIcon={<Settings />}
                sx={{ textTransform: `none`, fontWeight: 500 }}
              >
                Org settings
              </Button>
              <Button
                disabled
                size='small'
                variant='contained'
                title='Coming soon'
                startIcon={<Add />}
                sx={{ textTransform: `none`, fontWeight: 500 }}
              >
                New project
              </Button>
            </>
          }
        />

        <StatStrip
          cells={[
            { label: `Projects`, value: projects.length },
            { label: `Sandboxes`, value: sandboxes.length },
            { label: `Your role`, value: role ?? `-`, sans: true },
            { label: `Created`, value: formatDate(activeOrg?.createdAt), sans: true },
            { label: `Updated`, value: formatDate(activeOrg?.updatedAt), sans: true },
            { label: `Members`, value: `-`, sans: true },
          ]}
        />

        <SectionHeader
          title='Projects'
          count={projects.length}
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

        {projects.length === 0 ? (
          <ProjectsEmptyState />
        ) : (
          <Box
            sx={{
              display: `grid`,
              gap: `14px`,
              gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))`,
            }}
          >
            {projects.map((project) => (
              <ProjectCardItem
                key={project.id}
                project={project}
                onSelect={onSelect}
                sandboxCount={sbCounts.get(project.id) ?? 0}
              />
            ))}
          </Box>
        )}
      </Box>
    </Page>
  )
}

export default Projects
