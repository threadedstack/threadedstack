import type { Organization } from '@tdsk/domain'

import { ERoutePath } from '@TAF/types'
import { useNavigate } from 'react-router'
import { ife } from '@keg-hub/jsutils/ife'
import { Page } from '@TAF/pages/Page/Page'
import { useEffect, useState } from 'react'
import { Box, Alert, Typography } from '@mui/material'
import { fetchOrg } from '@TAF/actions/orgs/api/fetchOrg'
import { updateOrg } from '@TAF/actions/orgs/api/updateOrg'
import { deleteOrg } from '@TAF/actions/orgs/api/deleteOrg'
import { LoadingSpinner, ErrorAlert } from '@TAF/components'
import { useActiveOrgId, useActiveOrg } from '@TAF/state/selectors'
import {
  InfoCard,
  DangerZoneCard,
  SettingsFormCard,
  DeleteConfirmDialog,
} from '@TAF/components/Settings'

export type TOrgSettings = {}

export const OrgSettings = (props: TOrgSettings) => {
  const [org] = useActiveOrg()
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [localOrg, setLocalOrg] = useState<Organization>(org)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    localOrg !== org && setLocalOrg(org)
  }, [org])

  useEffect(() => {
    !org &&
      orgId &&
      ife(async () => {
        if (!orgId) return

        try {
          setLoading(true)
          setError(null)

          const orgResult = await fetchOrg(orgId)
          orgResult.error && setError(orgResult.error.message)
        } catch (err) {
          setError(err.message)
        } finally {
          setLoading(false)
        }
      })
  }, [org, orgId])

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
          Settings
        </Typography>
      </Box>

      {loading && <LoadingSpinner />}

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

      {!loading && org && (
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
            onCopy={onCopySuccess}
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

      <DeleteConfirmDialog
        onConfirm={onDelete}
        entityName={org?.name}
        open={deleteDialogOpen}
        entityType='Organization'
        onClose={() => setDeleteDialogOpen(false)}
        warningText='This will permanently delete all associated projects, secrets, and configurations.'
      />
    </Page>
  )
}

export default OrgSettings
