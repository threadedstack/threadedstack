import type { TProviderType } from '@tdsk/domain'
import type { TProviderLinkItem } from '@TAF/types'

import { useState } from 'react'
import { useProviders } from '@TAF/state/selectors'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { ProviderDrawer } from '@TAF/components/Providers/ProviderDrawer'
import { ProviderLinkList } from '@TAF/components/Providers/ProviderLinkList'
import {
  Box,
  Chip,
  Alert,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TSandboxProviderAccordionProps = {
  orgId: string
  title: string
  loading: boolean
  disabled: boolean
  addLabel: string
  createLabel: string
  reorderable?: boolean
  infoText?: string | null
  providersLoaded: boolean
  defaultType: TProviderType
  emptyMessage?: string | null
  warnMissingSecret?: boolean
  providers: TProviderLinkItem[]
  onRemove: (id: string) => void
  availableProviders: TProviderLinkItem[]
  onAdd: (provider: TProviderLinkItem) => void
  onProviderCreated?: (providerId?: string) => void
  onModelChange?: (id: string, model: string) => void
  onReorder?: (providers: TProviderLinkItem[]) => void
  onBranchChange?: (id: string, branch: string) => void
}

export const SandboxProviderAccordion = (props: TSandboxProviderAccordionProps) => {
  const {
    orgId,
    title,
    onAdd,
    loading,
    addLabel,
    onRemove,
    infoText,
    disabled,
    providers,
    onReorder,
    defaultType,
    createLabel,
    reorderable,
    emptyMessage,
    onModelChange,
    onBranchChange,
    providersLoaded,
    onProviderCreated,
    availableProviders,
    warnMissingSecret,
  } = props

  const [providersMap] = useProviders()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [fixSecretId, setFixSecretId] = useState<string | null>(null)

  return (
    <>
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            fontWeight={500}
            variant='subtitle1'
          >
            {title}
          </Typography>
          {providers.length > 0 && (
            <Chip
              size='small'
              sx={{ ml: 1 }}
              label={providers.length}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {providers.length === 0 && providersLoaded && emptyMessage && (
              <Alert
                severity='info'
                sx={{ fontSize: `0.875rem` }}
              >
                {emptyMessage}
              </Alert>
            )}

            <ProviderLinkList
              onAdd={onAdd}
              orgId={orgId}
              disabled={disabled}
              addLabel={addLabel}
              emptyMessage={null}
              onRemove={onRemove}
              providers={providers}
              onReorder={onReorder}
              reorderable={reorderable}
              createLabel={createLabel}
              loading={!providersLoaded}
              onModelChange={onModelChange}
              onBranchChange={onBranchChange}
              warnMissingSecret={warnMissingSecret}
              availableProviders={availableProviders}
              onCreateNew={() => setDrawerOpen(true)}
              onFixSecret={(id) => setFixSecretId(id)}
            />

            {providersLoaded &&
              availableProviders.length === 0 &&
              providers.length > 0 && (
                <Typography
                  variant='caption'
                  color='text.secondary'
                >
                  All compatible providers have been linked.
                </Typography>
              )}

            {infoText && (
              <Typography
                variant='caption'
                color='text.secondary'
              >
                {infoText}
              </Typography>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      <ProviderDrawer
        orgId={orgId}
        open={drawerOpen}
        defaultType={defaultType}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(providerId) => {
          onProviderCreated?.(providerId)
        }}
      />

      <ProviderDrawer
        orgId={orgId}
        open={!!fixSecretId}
        defaultType={defaultType}
        provider={fixSecretId ? providersMap?.[fixSecretId] : null}
        onClose={() => setFixSecretId(null)}
        onSuccess={() => setFixSecretId(null)}
      />
    </>
  )
}
