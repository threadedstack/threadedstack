import type { Skill } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState, useMemo } from 'react'
import { EPermResource } from '@tdsk/domain'
import { useSkills } from '@TAF/state/selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { SkillDrawer } from '@TAF/components/Skills/SkillDrawer'
import { deleteSkill } from '@TAF/actions/skills/api/deleteSkill'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { ConfirmDelete, Text, DataTableSkeleton } from '@tdsk/components'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material'

export type TSkills = {
  orgId?: string
}

const styles = {
  table: {
    actions: {
      box: {
        gap: 1.5,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `end`,
      },
      icon: { fontSize: `16px` },
    },
  },
}

const skeletonColumns = [
  { id: `name`, label: `Name` },
  { id: `description`, label: `Description` },
  { id: `alwaysActive`, label: `Always Active`, width: 50 },
  { id: `actions`, label: `Actions`, align: `right` as const },
]

export const Skills = (props: TSkills) => {
  const { orgId } = props

  const { canCreate, canUpdate, canDelete } = usePermissions()
  const [skillsMap] = useSkills()
  const isInitialLoading = skillsMap === undefined
  const skills = useMemo(() => Object.values(skillsMap || {}), [skillsMap])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleting, setDeleting] = useState<Skill>()
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error>()

  const onCreateSkill = () => {
    setSelectedSkill(null)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedSkill(null)
  }

  const onEditSkill = (skill: Skill) => {
    setSelectedSkill(skill)
    setDialogOpen(true)
  }

  const onRemove = async () => {
    if (!deleting || !orgId) return

    setLoading(true)
    setError(undefined)

    const result = await deleteSkill(orgId, deleting.id)

    if (result.error) {
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )
    }

    setLoading(false)
    setDeleting(undefined)
    dialogOpen && setDialogOpen(false)
  }

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills

    const query = searchQuery.toLowerCase()
    return skills.filter(
      (skill) =>
        skill.name?.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query) ||
        skill.id?.toLowerCase().includes(query)
    )
  }, [skills, searchQuery])

  const columns: TDataTableColumn<Skill>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (skill) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ExtensionIcon sx={{ color: 'text.secondary' }} />
          <Text
            variant='body2'
            fontWeight='medium'
          >
            {skill.name}
          </Text>
        </Box>
      ),
    },
    {
      id: 'description',
      label: 'Description',
      render: (skill) => (
        <Text
          display='block'
          overflow='hidden'
          variant='caption'
          whiteSpace='nowrap'
          textOverflow='ellipsis'
          color='text.secondary'
        >
          {skill.description}
        </Text>
      ),
    },
    {
      id: 'alwaysActive',
      label: 'Always Active',
      width: 50,
      render: (skill) => (
        <Chip
          size='small'
          label={skill.alwaysActive ? 'Yes' : 'No'}
          color={skill.alwaysActive ? 'success' : 'default'}
          variant='outlined'
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (skill) => (
        <Box sx={styles.table.actions.box}>
          <ActionIconButton
            tooltip='Edit Skill'
            icon={<EditIcon sx={styles.table.actions.icon} />}
            size='small'
            color='primary'
            disabled={!canUpdate(EPermResource.skill)}
            disabledTooltip='You do not have permission to edit skills'
            onClick={(e) => {
              e.stopPropagation()
              onEditSkill(skill)
            }}
          />
          <ActionIconButton
            tooltip='Delete Skill'
            icon={<DeleteIcon sx={styles.table.actions.icon} />}
            size='small'
            color='error'
            disabled={!canDelete(EPermResource.skill)}
            disabledTooltip='You do not have permission to delete skills'
            onClick={(e) => {
              e.stopPropagation()
              setDeleting(skill)
            }}
          />
        </Box>
      ),
    },
  ]

  return (
    <PageLayout
      title='Skills'
      loading={loading}
      searchCount={0}
      countLabel='skill'
      query={searchQuery}
      error={error?.message}
      actionIcon={<AddIcon />}
      setSearchQuery={setSearchQuery}
      onAction={skills.length > 0 && onCreateSkill}
      actionLabel={skills.length > 0 && 'Create Skill'}
      actionDisabled={!canCreate(EPermResource.skill)}
      count={isInitialLoading ? undefined : skills.length}
      searchPlaceholder='Search skills by name or description...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && !error && skills.length === 0 && !loading && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateSkill}
          actionLabel='Create Skill'
          actionDisabled={!canCreate(EPermResource.skill)}
          message='No skills yet. Create your first skill to get started.'
        />
      )}

      {!isInitialLoading &&
        !error &&
        skills.length > 0 &&
        filteredSkills.length === 0 && (
          <EmptyState message='No skills match your search query.' />
        )}

      {!error && filteredSkills.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredSkills}
          onRowClick={onEditSkill}
          getRowKey={(skill) => skill.id}
        />
      )}

      {orgId && (
        <SkillDrawer
          orgId={orgId}
          open={dialogOpen}
          onRemove={setDeleting}
          skill={selectedSkill}
          onClose={onDialogClose}
        />
      )}

      {deleting && (
        <ConfirmDelete
          deleting={loading}
          onConfirm={onRemove}
          itemName={deleting?.name || `Skill`}
          onCancel={() => setDeleting(undefined)}
        />
      )}
    </PageLayout>
  )
}

export default Skills
