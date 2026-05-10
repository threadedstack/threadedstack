import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete } from '@tdsk/components'
import { useState } from 'react'
import { ErrorAlert } from '@TAF/components'
import { useProjects } from '@TAF/state/selectors'
import { updateProject } from '@TAF/actions/projects/api/updateProject'
import { deleteProject } from '@TAF/actions/projects/api/deleteProject'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { InfoCard, DangerZoneCard, SettingsFormCard } from '@TAF/components/Settings'
import { Box, Alert, Typography } from '@mui/material'

export type TProjectSettings = {}

export const ProjectSettings = (props: TProjectSettings) => {
  const navigate = useNavigate()
  const [projects] = useProjects()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()

  const project = projects && projectId ? projects[projectId] : null

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState(project?.name || '')
  const [originalName, setOriginalName] = useState(project?.name || '')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const hasChanges = name !== originalName

  const onSave = async () => {
    if (!projectId || !hasChanges) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const result = await updateProject({
      name,
      orgId,
      id: projectId,
    })

    if (result.error) {
      setError(result.error.message)
    } else {
      setSuccess('Project updated successfully')
      setOriginalName(name)
    }

    setSaving(false)
  }

  const onDeleteClick = () => {
    setDeleteDialogOpen(true)
  }

  const onDelete = async () => {
    if (!projectId || !project) return

    const result = await deleteProject({ orgId, id: projectId })

    if (result.error) {
      setError(result.error.message)
      setDeleteDialogOpen(false)
    } else {
      navigate(`/orgs/${orgId}/projects`)
    }
  }

  return (
    <Page className='tdsk-project-settings-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          {project?.name || `Project`}
        </Typography>
      </Box>

      {error && (
        <ErrorAlert
          message={error}
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        />
      )}

      {success && (
        <Alert
          severity='success'
          sx={{ mb: 3 }}
        >
          {success}
        </Alert>
      )}

      {project && (
        <>
          <SettingsFormCard
            fields={[
              {
                name: 'name',
                label: 'Project Name',
                value: name,
                onChange: setName,
              },
            ]}
            onSave={onSave}
            hasChanges={hasChanges}
            saving={saving}
          />

          <InfoCard
            title='Project Information'
            items={[
              { label: 'Project ID', value: project.id, copyable: true },
              { label: 'Org ID', value: project.orgId, copyable: true },
              ...(project.createdAt
                ? [{ label: 'Created', value: String(project.createdAt), isDate: true }]
                : []),
              ...(project.updatedAt
                ? [
                    {
                      label: 'Last Updated',
                      value: String(project.updatedAt),
                      isDate: true,
                    },
                  ]
                : []),
            ]}
          />

          <DangerZoneCard
            onAction={onDeleteClick}
            title='Delete this project'
            buttonLabel='Delete Project'
            description='Once deleted, this action cannot be undone. All data will be lost.'
          />
        </>
      )}

      <ConfirmDelete
        onConfirm={onDelete}
        title='Delete Project?'
        open={deleteDialogOpen}
        itemName={project?.name}
        onCancel={() => setDeleteDialogOpen(false)}
        warnText='This will permanently delete all associated endpoints, functions, and secrets.'
      />
    </Page>
  )
}

export default ProjectSettings
