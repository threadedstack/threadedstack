import type { Organization } from '@tdsk/domain'

import { ERoutePath } from '@TAF/types'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { useState, useEffect } from 'react'
import { ConfirmDelete } from '@tdsk/components'
import { Box, Alert, Typography } from '@mui/material'
import { updateOrg } from '@TAF/actions/orgs/api/updateOrg'
import { deleteOrg } from '@TAF/actions/orgs/api/deleteOrg'
import { ErrorAlert } from '@TAF/components'
import { useActiveOrgId, useActiveOrg } from '@TAF/state/selectors'
import { InfoCard, DangerZoneCard, SettingsFormCard } from '@TAF/components/Settings'

export type TOrgSettings = {}

export const OrgSettings = (props: TOrgSettings) => {
  const [org] = useActiveOrg()
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [localOrg, setLocalOrg] = useState<Organization>(org)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    org && setLocalOrg(org)
  }, [org])

  const hasChanges =
    org?.name !== localOrg?.name || org?.description !== localOrg?.description

  const onSave = async () => {
    if (!orgId || !hasChanges) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const result = await updateOrg(orgId, localOrg)
      result.error
        ? setError(result.error.message)
        : setSuccess(`Org updated successfully`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
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

  return (
    <Page className='tdsk-org-settings-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          Settings
        </Typography>
      </Box>

      {error && (
        <ErrorAlert
          sx={{ mb: 3 }}
          message={error}
          onClose={() => setError(null)}
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

      {org && (
        <>
          <SettingsFormCard
            saving={saving}
            title='General'
            onSave={onSave}
            hasChanges={hasChanges}
            fields={[
              {
                name: `name`,
                label: `Name`,
                value: localOrg?.name ?? ``,
                onChange: (name: string) => setLocalOrg({ ...localOrg, name }),
              },
              {
                rows: 3,
                multiline: true,
                name: `description`,
                label: `Description`,
                value: localOrg?.description ?? ``,
                onChange: (description: string) =>
                  setLocalOrg({ ...localOrg, description }),
              },
            ]}
          />

          <InfoCard
            title='Metadata'
            items={[
              { label: `ID`, value: org.id, copyable: true },
              ...(org.createdAt
                ? [{ label: `Created`, value: String(org.createdAt), isDate: true }]
                : []),
              ...(org.updatedAt
                ? [{ label: `Last Updated`, value: String(org.updatedAt), isDate: true }]
                : []),
            ]}
          />

          <DangerZoneCard
            buttonLabel='Delete'
            onAction={onDeleteClick}
            title='Delete this organization'
            description='Once deleted, this action cannot be undone. All projects and data will be lost.'
          />
        </>
      )}

      <ConfirmDelete
        onConfirm={onDelete}
        itemName={org?.name}
        open={deleteDialogOpen}
        title='Delete Organization?'
        onCancel={() => setDeleteDialogOpen(false)}
        warnText='This will permanently delete all associated projects, secrets, and configurations.'
      />
    </Page>
  )
}

export default OrgSettings
