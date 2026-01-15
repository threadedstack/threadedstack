import { ERoutePath } from '@TAF/types'
import { useEffect, useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { useOrgs } from '@TAF/state/selectors'
import { useParams, useNavigate } from 'react-router'
import { setActiveOrgId } from '@TAF/state/accessors'
import { fetchOrg, updateOrg, deleteOrg } from '@TAF/actions/orgs'
import { LoadingSpinner, ErrorAlert } from '@TAF/components'
import {
  SettingsFormCard,
  InfoCard,
  DangerZoneCard,
  DeleteConfirmDialog,
} from '@TAF/components/Settings'
import { Box, Alert, Typography } from '@mui/material'

export type TOrgSettings = {}

export const OrgSettings = (props: TOrgSettings) => {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const [orgs] = useOrgs()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [originalDescription, setOriginalDescription] = useState('')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (orgId) {
      setActiveOrgId(orgId)
    }
  }, [orgId])

  useEffect(() => {
    const loadData = async () => {
      if (!orgId) return

      setLoading(true)
      setError(null)

      const orgResult = await fetchOrg(orgId)

      if (orgResult.error) {
        setError(orgResult.error.message)
      } else if (orgResult.org) {
        setName(orgResult.org.name || '')
        setDescription(orgResult.org.description || '')
        setOriginalName(orgResult.org.name || '')
        setOriginalDescription(orgResult.org.description || '')
      }

      setLoading(false)
    }

    loadData()
  }, [orgId])

  const org = orgs && orgId ? orgs[orgId] : null
  const hasChanges = name !== originalName || description !== originalDescription

  const onSave = async () => {
    if (!orgId || !hasChanges) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const result = await updateOrg(orgId, { name, description })

    if (result.error) {
      setError(result.error.message)
    } else {
      setSuccess('Org updated successfully')
      setOriginalName(name)
      setOriginalDescription(description)
    }

    setSaving(false)
  }

  const onDeleteClick = () => {
    setDeleteDialogOpen(true)
  }

  const onDelete = async () => {
    if (!orgId || !org) return

    const result = await deleteOrg(orgId)

    if (result.error) {
      setError(result.error.message)
      setDeleteDialogOpen(false)
    } else {
      navigate(ERoutePath.Orgs)
    }
  }

  const onCopySuccess = (message: string) => {
    setSuccess(message)
    setTimeout(() => setSuccess(null), 2000)
  }

  return (
    <Page className='tdsk-org-settings-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          Org Settings
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

      {!loading && org && (
        <>
          <SettingsFormCard
            fields={[
              {
                name: 'name',
                label: 'Org Name',
                value: name,
                onChange: setName,
              },
              {
                name: 'description',
                label: 'Description',
                value: description,
                onChange: setDescription,
                multiline: true,
                rows: 3,
              },
            ]}
            onSave={onSave}
            hasChanges={hasChanges}
            saving={saving}
          />

          <InfoCard
            title='Org Information'
            items={[
              { label: 'Org ID', value: org.id, copyable: true },
              ...(org.createdAt
                ? [{ label: 'Created', value: String(org.createdAt), isDate: true }]
                : []),
              ...(org.updatedAt
                ? [{ label: 'Last Updated', value: String(org.updatedAt), isDate: true }]
                : []),
            ]}
            onCopy={onCopySuccess}
          />

          <DangerZoneCard
            title='Delete this org'
            description='Once deleted, this action cannot be undone. All projects and data will be lost.'
            buttonLabel='Delete Org'
            onAction={onDeleteClick}
          />
        </>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        entityName={org?.name}
        entityType='Org'
        warningText='This will permanently delete all associated projects, secrets, and configurations.'
        onConfirm={onDelete}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </Page>
  )
}

export default OrgSettings
