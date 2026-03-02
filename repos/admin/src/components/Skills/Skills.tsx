import type { Skill } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { ConfirmDelete, Text } from '@tdsk/components'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { SkillDrawer } from '@TAF/components/Skills/SkillDrawer'
import { skillsApi } from '@TAF/services/skillsApi'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Extension as ExtensionIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
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

export const Skills = (props: TSkills) => {
  const { orgId } = props

  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleting, setDeleting] = useState<Skill>()
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error>()

  const fetchSkills = useCallback(async () => {
    if (!orgId) return

    setLoading(true)
    const resp = await skillsApi.list(orgId)
    setLoading(false)

    if (resp.error) {
      setError(resp.error instanceof Error ? resp.error : new Error(String(resp.error)))
    } else {
      setSkills(resp.data || [])
    }
  }, [orgId])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

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

    const result = await skillsApi.delete(orgId, deleting.id)

    setLoading(false)
    setDeleting(undefined)
    dialogOpen && setDialogOpen(false)

    if (result.error) {
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )
    } else {
      fetchSkills()
    }
  }

  const onSuccess = () => {
    fetchSkills()
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
      count={skills.length}
      error={error?.message}
      setSearchQuery={setSearchQuery}
      actionIcon={<AddIcon />}
      onAction={skills.length > 0 && onCreateSkill}
      actionLabel={skills.length > 0 && 'Create Skill'}
      searchPlaceholder='Search skills by name or description...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {!error && skills.length === 0 && !loading && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateSkill}
          actionLabel='Create Skill'
          message='No skills yet. Create your first skill to get started.'
        />
      )}

      {!error && skills.length > 0 && filteredSkills.length === 0 && (
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
          onSuccess={onSuccess}
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
