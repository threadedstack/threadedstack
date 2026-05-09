import type { TSandboxDrawer } from '@TAF/types'
import type { Provider } from '@tdsk/domain'

import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useSandboxForm } from '@TAF/hooks/sandboxes/useSandboxForm'
import { SecretSelector } from '@TAF/components/SecretSelector/SecretSelector'
import { SandboxGuiAccordion } from '@TAF/components/Sandboxes/SandboxGuiAccordion'
import { SandboxConfigAccordion } from '@TAF/components/Sandboxes/SandboxConfigAccordion'
import { SandboxProviderAccordion } from '@TAF/components/Sandboxes/SandboxProviderAccordion'
import { SandboxContainerAccordion } from '@TAF/components/Sandboxes/SandboxContainerAccordion'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'
import { EProvider, ESecretMode, SandboxRuntimeOptions } from '@tdsk/domain'
import {
  Box,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export const ProjectSandboxDrawer = (props: TSandboxDrawer) => {
  const {
    open,
    orgId,
    sandbox,
    onRemove,
    projectId,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
  } = props

  const form = useSandboxForm({
    orgId,
    sandbox,
    onRemove,
    projectId,
    onCloseCB,
    onSuccessCB,
  })

  return (
    <Drawer
      open={open}
      onClose={form.onClose}
      title={
        form.isEditMode ? 'Edit Project Sandbox' : 'Connect a Sandbox to This Project'
      }
      actions={
        <DrawerActions
          form='project-sandbox-form'
          actions={form.actions}
          loading={form.loading}
          disabled={form.loading}
          editing={form.isEditMode}
        />
      }
    >
      <form id='project-sandbox-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {form.error && (
            <ErrorAlert
              message={form.error}
              onClose={() => form.setError(null)}
            />
          )}

          <TextInput
            required
            fullWidth
            label='Name'
            id='sandbox-name'
            value={form.name}
            disabled={form.loading}
            placeholder='Enter sandbox name'
            onChange={(e) => form.setName(e.target.value)}
          />

          <TextInput
            fullWidth
            label='Alias'
            id='sandbox-alias'
            value={form.alias}
            disabled={form.loading}
            placeholder='Auto-generated from name if empty'
            helperText='Used in tsa ssh <alias>. Leave empty for auto-generated.'
            onChange={(e) => form.setAlias(e.target.value)}
          />

          {!form.isEditMode && form.projectSandboxList.length > 0 && (
            <SelectInput
              id='sandbox-base'
              disabled={form.loading}
              label='Base Sandbox'
              value={form.baseSandboxId || ''}
              placeholder='Start from an existing sandbox...'
              items={form.projectSandboxList.map((s) => ({
                value: s.id,
                label: s.name || s.id,
              }))}
              onChange={(e) => form.onSelectBaseSandbox(e.target.value || null)}
            />
          )}

          <SandboxConfigAccordion
            form={form}
            initScriptHelperText='(appended to org init script)'
          />

          {/* Git Repository */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                fontWeight={500}
                variant='subtitle1'
              >
                Git Repository
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextInput
                  fullWidth
                  value={form.gitRepo}
                  disabled={form.loading}
                  id='sandbox-git-repo'
                  label='Git Repository URL'
                  placeholder='https://github.com/org/repo.git'
                  onChange={(e) => form.setGitRepo(e.target.value)}
                />
                <TextInput
                  fullWidth
                  value={form.gitBranch}
                  disabled={form.loading}
                  label='Git Branch'
                  placeholder='main'
                  id='sandbox-git-branch'
                  onChange={(e) => form.setGitBranch(e.target.value)}
                />
                <SecretSelector
                  mode={form.gitTokenMode}
                  disabled={form.loading}
                  editing={form.isEditMode}
                  secretOptions={form.secretOptions}
                  editLabel='Change Auth Token'
                  newSecretValue={form.newGitTokenValue}
                  selectedSecretId={form.gitTokenSecretId}
                  onSecretSelect={form.setGitTokenSecretId}
                  label='Auth Token (for private repos)'
                  onNewValueChange={form.setNewGitTokenValue}
                  valuePlaceholder='Enter git auth token (e.g. GitHub PAT)...'
                  onModeChange={(mode) => {
                    form.setGitTokenMode(mode)
                    form.setNewGitTokenValue(``)
                    form.setGitTokenSecretId(``)
                  }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* AI Providers */}
          <SandboxProviderAccordion
            orgId={orgId}
            title='AI Providers'
            loading={form.loading}
            disabled={form.loading}
            defaultType={EProvider.ai}
            addLabel='Add Provider'
            createLabel='Create AI Provider'
            reorderable
            providersLoaded={!!form.providersMap}
            emptyMessage={
              !form.isCustomRuntime
                ? `No provider linked. The AI tool will need credentials to authenticate. Link a compatible provider below.`
                : null
            }
            providers={form.linkedProviders.map((p) => ({
              id: p.id,
              name: p.name || p.id,
              brand: p.brand,
              model: form.providerModels[p.id] ?? null,
            }))}
            availableProviders={form.availableProviders.map((p) => ({
              id: p.id,
              name: p.name || p.id,
              brand: p.brand,
            }))}
            onAdd={(p) =>
              form.onAddProvider({
                id: p.id,
                brand: p.brand,
                name: p.name,
                type: 'ai',
              } as Provider)
            }
            onReorder={(items) => form.setProviderIds(items.map((p) => p.id))}
            onModelChange={(id, model) =>
              form.setProviderModels((prev) => ({ ...prev, [id]: model }))
            }
            onRemove={form.onRemoveProvider}
            infoText={
              form.compatibleBrands
                ? `Compatible brands for ${SandboxRuntimeOptions.find((o) => o.value === form.runtime)?.label || form.runtime}: ${form.compatibleBrands.filter((b) => !b.includes(':')).join(', ')}. Merged with org-level providers.`
                : `Merged with org-level providers.`
            }
            onProviderCreated={(providerId) => {
              if (providerId) form.setProviderIds((prev) => [...prev, providerId])
            }}
          />

          {/* Docker Registries */}
          <SandboxProviderAccordion
            orgId={orgId}
            title='Docker Registries'
            loading={form.loading}
            disabled={form.loading}
            defaultType={EProvider.docker}
            addLabel='Add Registry'
            createLabel='Create Docker Provider'
            providersLoaded={!!form.providersMap}
            emptyMessage='Link a Docker registry provider to pull private container images.'
            providers={form.linkedDockerProviders.map((p) => ({
              id: p.id,
              name: p.name || p.id,
              brand: p.brand,
            }))}
            availableProviders={form.availableDockerProviders.map((p) => ({
              id: p.id,
              name: p.name || p.id,
              brand: p.brand,
            }))}
            onAdd={(p) => form.setDockerProviderIds((prev) => [...prev, p.id])}
            onRemove={(id) =>
              form.setDockerProviderIds((prev) => prev.filter((did) => did !== id))
            }
            infoText='Merged with org-level registries.'
            onProviderCreated={(providerId) => {
              if (providerId) form.setDockerProviderIds((prev) => [...prev, providerId])
            }}
          />

          <SandboxGuiAccordion
            form={form}
            toggleLabel='Override org GUI config'
          />

          <SandboxContainerAccordion
            form={form}
            workdirHelperText='Overrides org-level working directory.'
            envVarsLabel='Environment Variables (overrides org by name)'
            portsLabel='Ports (overrides org by port key)'
          />
        </Box>
      </form>
    </Drawer>
  )
}
