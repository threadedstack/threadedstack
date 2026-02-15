import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete } from '@tdsk/components'
import { useEffect, useState } from 'react'
import { LoadingSpinner, ErrorAlert } from '@TAF/components'
import { useProjects } from '@TAF/state/selectors'
import { fetchProject } from '@TAF/actions/projects/api/fetchProject'
import { updateProject } from '@TAF/actions/projects/api/updateProject'
import { deleteProject } from '@TAF/actions/projects/api/deleteProject'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { InfoCard, DangerZoneCard, SettingsFormCard } from '@TAF/components/Settings'
import { Box, Alert, Typography } from '@mui/material'

export type TProjectSettings = {}

// TODO: clean this up to work like Org settings
export const ProjectSettings = (props: TProjectSettings) => {
  const navigate = useNavigate()
  const [projects] = useProjects()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [originalGitUrl, setOriginalGitUrl] = useState('')
  const [originalBranch, setOriginalBranch] = useState('')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return

      setLoading(true)
      setError(null)

      const projectResult = await fetchProject({ orgId, id: projectId })

      if (projectResult.error) {
        setError(projectResult.error.message)
      } else if (projectResult.project) {
        setName(projectResult.project.name || '')
        setGitUrl(projectResult.project.gitUrl || '')
        setBranch(projectResult.project.branch || '')
        setOriginalName(projectResult.project.name || '')
        setOriginalGitUrl(projectResult.project.gitUrl || '')
        setOriginalBranch(projectResult.project.branch || '')
      }

      setLoading(false)
    }
    loadData()
  }, [projectId])

  const project = projects && projectId ? projects[projectId] : null
  const hasChanges =
    name !== originalName || gitUrl !== originalGitUrl || branch !== originalBranch

  const onSave = async () => {
    if (!projectId || !hasChanges) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const result = await updateProject({
      orgId,
      id: projectId,
      data: { name, gitUrl, branch },
    })

    if (result.error) {
      setError(result.error.message)
    } else {
      setSuccess('Project updated successfully')
      setOriginalName(name)
      setOriginalGitUrl(gitUrl)
      setOriginalBranch(branch)
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

  const onCopySuccess = (message: string) => {
    setSuccess(message)
    setTimeout(() => setSuccess(null), 2000)
  }

  return (
    <Page className='tdsk-project-settings-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          Project Settings
        </Typography>
      </Box>

      {loading && <LoadingSpinner />}

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

      {!loading && project && (
        <>
          <SettingsFormCard
            fields={[
              {
                name: 'name',
                label: 'Project Name',
                value: name,
                onChange: setName,
              },
              {
                name: 'gitUrl',
                label: 'Git URL',
                value: gitUrl,
                onChange: setGitUrl,
                placeholder: 'https://github.com/username/project.git',
              },
              {
                name: 'branch',
                label: 'Branch',
                value: branch,
                onChange: setBranch,
                placeholder: 'main',
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
            onCopy={onCopySuccess}
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
