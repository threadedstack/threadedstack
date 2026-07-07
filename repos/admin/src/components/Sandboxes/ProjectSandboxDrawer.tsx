import type { Provider } from '@tdsk/domain'
import type { TSandboxDrawer } from '@TAF/types'

import { Box } from '@mui/material'
import { EProvider, SandboxRuntimeOptions } from '@tdsk/domain'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useSandboxForm } from '@TAF/hooks/sandboxes/useSandboxForm'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'
import { SandboxGuiAccordion } from '@TAF/components/Sandboxes/SandboxGuiAccordion'
import { SandboxSkillsAccordion } from '@TAF/components/Sandboxes/SandboxSkillsAccordion'
import { SandboxConfigAccordion } from '@TAF/components/Sandboxes/SandboxConfigAccordion'
import { SandboxProviderAccordion } from '@TAF/components/Sandboxes/SandboxProviderAccordion'
import { SandboxContainerAccordion } from '@TAF/components/Sandboxes/SandboxContainerAccordion'

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
            onChange={(e) => form.setAlias(e.target.value)}
            placeholder='Auto-generated from name if empty'
            helperText='Used in tsa ssh <alias>. Leave empty for auto-generated.'
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

          {/* Git Repositories */}
          <SandboxProviderAccordion
            orgId={orgId}
            loading={form.loading}
            disabled={form.loading}
            title='Git Repositories'
            defaultType={EProvider.git}
            addLabel='Add Git Repository'
            createLabel='Create Git Provider'
            providersLoaded={!!form.providersMap}
            infoText='Select which git repos to clone into this sandbox.'
            emptyMessage='Link a git provider to clone repositories into this sandbox.'
            onAdd={(p) => form.setGitProviderIds((prev) => [...prev, p.id])}
            providers={form.linkedGitProviders.map((p) => ({
              id: p.id,
              name: p.name || p.id,
              brand: p.brand,
              branch: form.gitBranchOverrides[p.id] ?? null,
            }))}
            availableProviders={form.availableGitProviders.map((p) => ({
              id: p.id,
              name: p.name || p.id,
              brand: p.brand,
            }))}
            onBranchChange={(id, branch) =>
              form.setGitBranchOverrides((prev) => ({ ...prev, [id]: branch }))
            }
            onRemove={(id) => {
              form.setGitProviderIds((prev) => prev.filter((gid) => gid !== id))
              form.setGitBranchOverrides((prev) => {
                const next = { ...prev }
                delete next[id]
                return next
              })
            }}
            onProviderCreated={(providerId) => {
              if (providerId) form.setGitProviderIds((prev) => [...prev, providerId])
            }}
          />

          {/* AI Providers */}
          <SandboxProviderAccordion
            orgId={orgId}
            title='AI Providers'
            loading={form.loading}
            disabled={form.loading}
            addLabel='Add Provider'
            defaultType={EProvider.ai}
            createLabel='Create AI Provider'
            reorderable
            warnMissingSecret
            providersLoaded={!!form.providersMap}
            emptyMessage={
              !form.isCustomRuntime
                ? `No provider linked. The AI tool will need credentials to authenticate. Link a compatible provider below.`
                : null
            }
            providers={form.linkedProviders.map((p) => ({
              id: p.id,
              brand: p.brand,
              name: p.name || p.id,
              baseUrl: p.options?.baseUrl,
              model: form.providerModels[p.id] ?? null,
              secretId: p.secretId,
            }))}
            availableProviders={form.availableProviders.map((p) => ({
              id: p.id,
              brand: p.brand,
              name: p.name || p.id,
              baseUrl: p.options?.baseUrl,
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
            loading={form.loading}
            disabled={form.loading}
            addLabel='Add Registry'
            title='Docker Registries'
            defaultType={EProvider.docker}
            createLabel='Create Docker Provider'
            providersLoaded={!!form.providersMap}
            infoText='Merged with org-level registries.'
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
            onProviderCreated={(providerId) => {
              if (providerId) form.setDockerProviderIds((prev) => [...prev, providerId])
            }}
          />

          {/* Skills */}
          <SandboxSkillsAccordion
            orgId={orgId}
            projectId={projectId}
            loading={form.loading}
            disabled={form.loading}
            orgSkills={form.linkedOrgSkills}
            projectSkills={form.linkedProjectSkills}
            availableSkills={form.availableSkills}
            onAddSkill={(s) => form.setProjectSkillIds((prev) => [...prev, s.id])}
            onRemoveSkill={(id) =>
              form.setProjectSkillIds((prev) => prev.filter((sid) => sid !== id))
            }
          />

          <SandboxGuiAccordion
            form={form}
            toggleLabel='Override org GUI config'
          />

          <SandboxContainerAccordion
            form={form}
            portsLabel='Ports (overrides org by port key)'
            workdirHelperText='Overrides org-level working directory.'
            envVarsLabel='Environment Variables (overrides org by name)'
          />
        </Box>
      </form>
    </Drawer>
  )
}
