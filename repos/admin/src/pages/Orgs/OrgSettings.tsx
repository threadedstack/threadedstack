import type { Organization, TGuiConfig } from '@tdsk/domain'

import { ERoutePath } from '@TAF/types'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { ErrorAlert } from '@TAF/components'
import SaveIcon from '@mui/icons-material/Save'
import { ConfirmDelete } from '@tdsk/components'
import { useState, useEffect, useMemo } from 'react'
import { updateOrg } from '@TAF/actions/orgs/api/updateOrg'
import { deleteOrg } from '@TAF/actions/orgs/api/deleteOrg'
import { isFeatureEnabled, EPermResource } from '@tdsk/domain'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { GuiConfigForm } from '@TAF/components/GuiConfig/GuiConfigForm'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { Box, Alert, Typography, Card, CardContent, Divider } from '@mui/material'
import { useActiveOrgId, useActiveOrg, useProviders } from '@TAF/state/selectors'
import { InfoCard, DangerZoneCard, SettingsFormCard } from '@TAF/components/Settings'

export type TOrgSettings = {}

export const OrgSettings = (props: TOrgSettings) => {
  const [org] = useActiveOrg()
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()
  const [providersMap] = useProviders()
  const { canUpdate, canDelete } = usePermissions()
  const updateDisabled = !canUpdate(EPermResource.org)
  const deleteDisabled = !canDelete(EPermResource.org)

  const [saving, setSaving] = useState(false)
  const [guiSaving, setGuiSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [localOrg, setLocalOrg] = useState<Organization>(org)
  const [localGuiConfig, setLocalGuiConfig] = useState<TGuiConfig | undefined>(
    org?.config?.guiConfig
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (!org) return
    setLocalOrg(org)
    setLocalGuiConfig(org.config?.guiConfig)
  }, [org])

  const orgProviders = useMemo(() => {
    if (!providersMap) return []
    return Object.values(providersMap)
      .filter((p) => p.type === 'ai')
      .map((p) => ({ id: p.id, name: p.name || p.id, brand: p.brand }))
  }, [providersMap])

  const hasChanges =
    org?.name !== localOrg?.name || org?.description !== localOrg?.description

  const guiHasChanges =
    JSON.stringify(localGuiConfig) !== JSON.stringify(org?.config?.guiConfig)

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

  const onSaveGuiConfig = async () => {
    if (!orgId || !guiHasChanges) return

    try {
      setGuiSaving(true)
      setError(null)
      setSuccess(null)

      const result = await updateOrg(orgId, {
        config: { ...org?.config, guiConfig: localGuiConfig },
      })
      result.error
        ? setError(result.error.message)
        : setSuccess(`Generative UI config saved successfully`)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuiSaving(false)
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
            disabled={updateDisabled}
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

          {isFeatureEnabled('terminalGui') && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant='h6'>Generative UI</Typography>
                <Divider sx={{ my: 2 }} />
                <GuiConfigForm
                  config={localGuiConfig}
                  orgProviders={orgProviders}
                  onChange={setLocalGuiConfig}
                />
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <LoadingButton
                    color='success'
                    onClick={onSaveGuiConfig}
                    loading={guiSaving}
                    Icon={<SaveIcon />}
                    variant='contained'
                    disabled={updateDisabled || !guiHasChanges}
                    loadingText='Saving...'
                  >
                    Save
                  </LoadingButton>
                </Box>
              </CardContent>
            </Card>
          )}

          <DangerZoneCard
            buttonLabel='Delete'
            disabled={deleteDisabled}
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
