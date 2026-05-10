import type { TSandboxDrawer } from '@TAF/types'
import type { Provider } from '@tdsk/domain'

import { EProvider, SandboxRuntimeOptions } from '@tdsk/domain'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useSandboxForm } from '@TAF/hooks/sandboxes/useSandboxForm'
import { Drawer, TextInput, AutoInput, DrawerActions } from '@tdsk/components'
import { SandboxGuiAccordion } from '@TAF/components/Sandboxes/SandboxGuiAccordion'
import { SandboxConfigAccordion } from '@TAF/components/Sandboxes/SandboxConfigAccordion'
import { SandboxProviderAccordion } from '@TAF/components/Sandboxes/SandboxProviderAccordion'
import { SandboxContainerAccordion } from '@TAF/components/Sandboxes/SandboxContainerAccordion'
import {
  Box,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export const OrgSandboxDrawer = (props: TSandboxDrawer) => {
  const {
    open,
    orgId,
    sandbox,
    onRemove,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
  } = props

  const form = useSandboxForm({
    orgId,
    sandbox,
    onRemove,
    onCloseCB,
    onSuccessCB,
  })

  return (
    <Drawer
      open={open}
      onClose={form.onClose}
      title={
        form.isEditMode ? 'Edit Runtime Environment' : 'Define a Runtime Environment'
      }
      actions={
        <DrawerActions
          form='org-sandbox-form'
          actions={form.actions}
          loading={form.loading}
          disabled={form.loading}
          editing={form.isEditMode}
        />
      }
    >
      <form id='org-sandbox-form'>
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
            value={form.name}
            id='sandbox-name'
            disabled={form.loading}
            placeholder='Enter sandbox name'
            onChange={(e) => form.setName(e.target.value)}
          />

          <SandboxConfigAccordion
            form={form}
            initScriptHelperText={
              !form.isCustomRuntime
                ? `(pre-filled from ${SandboxRuntimeOptions.find((o) => o.value === form.runtime)?.label || form.runtime} preset)`
                : undefined
            }
          >
            <AutoInput
              label='Projects'
              id='sandbox-projects'
              disabled={form.loading}
              placeholder='Select projects...'
              value={form.selectedProjectIds}
              options={form.orgProjects.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              onChange={form.setSelectedProjectIds}
            />
          </SandboxConfigAccordion>

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
                type: `ai`,
                name: p.name,
                brand: p.brand,
              } as Provider)
            }
            onReorder={(items) => form.setProviderIds(items.map((p) => p.id))}
            onModelChange={(id, model) =>
              form.setProviderModels((prev) => ({ ...prev, [id]: model }))
            }
            onRemove={form.onRemoveProvider}
            infoText={
              form.compatibleBrands
                ? `Compatible brands for ${SandboxRuntimeOptions.find((o) => o.value === form.runtime)?.label || form.runtime}: ${form.compatibleBrands.filter((b) => !b.includes(':')).join(', ')}`
                : null
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
            createLabel='Create Docker Provider'
            defaultType={EProvider.docker}
            providersLoaded={!!form.providersMap}
            emptyMessage='Link a Docker registry provider to pull private container images.'
            providers={form.linkedDockerProviders.map((p) => ({
              id: p.id,
              brand: p.brand,
              name: p.name || p.id,
            }))}
            availableProviders={form.availableDockerProviders.map((p) => ({
              id: p.id,
              brand: p.brand,
              name: p.name || p.id,
            }))}
            onAdd={(p) => form.setDockerProviderIds((prev) => [...prev, p.id])}
            onRemove={(id) =>
              form.setDockerProviderIds((prev) => prev.filter((did) => did !== id))
            }
            onProviderCreated={(providerId) => {
              if (providerId) form.setDockerProviderIds((prev) => [...prev, providerId])
            }}
          />

          <SandboxGuiAccordion
            form={form}
            toggleLabel='Enable Generative UI'
          />

          <SandboxContainerAccordion form={form} />

          {/* Resources */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                fontWeight={500}
                variant='subtitle1'
              >
                Resources
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextInput
                    fullWidth
                    value={form.cpuLimit}
                    label='CPU Limit'
                    disabled={form.loading}
                    placeholder='500m'
                    id='sandbox-cpu-limit'
                    onChange={(e) => form.setCpuLimit(e.target.value)}
                  />
                  <TextInput
                    fullWidth
                    value={form.memoryLimit}
                    disabled={form.loading}
                    label='Memory Limit'
                    placeholder='256Mi'
                    id='sandbox-memory-limit'
                    onChange={(e) => form.setMemoryLimit(e.target.value)}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextInput
                    fullWidth
                    value={form.cpuRequest}
                    disabled={form.loading}
                    label='CPU Request'
                    placeholder='100m'
                    id='sandbox-cpu-request'
                    onChange={(e) => form.setCpuRequest(e.target.value)}
                  />
                  <TextInput
                    fullWidth
                    disabled={form.loading}
                    placeholder='128Mi'
                    label='Memory Request'
                    value={form.memoryRequest}
                    id='sandbox-memory-request'
                    onChange={(e) => form.setMemoryRequest(e.target.value)}
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </form>
    </Drawer>
  )
}
