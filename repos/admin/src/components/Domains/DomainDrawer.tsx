import type { Domain } from '@tdsk/domain'

import { isDomain } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { ConfirmDelete, Drawer, TextInput } from '@tdsk/components'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { createDomain, updateDomain, deleteDomain } from '@TAF/actions/domains/api'

export type TDomainDrawer = {
  open: boolean
  orgId?: string
  projectId?: string
  onClose: () => void
  domain?: Domain | null
  onSuccess?: () => void
}

export const DomainDrawer = ({
  open,
  orgId,
  domain,
  projectId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TDomainDrawer) => {
  const isEditMode = !!domain

  const [loading, setLoading] = useState(false)
  const [domainName, setDomainName] = useState('')
  const [sslPrivateKey, setSslPrivateKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sslCertificate, setSslCertificate] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (domain) {
      setError(null)
      setShowDeleteConfirm(false)
      setDomainName(domain.domain || '')
      setSslPrivateKey(domain.sslPrivateKey || '')
      setSslCertificate(domain.sslCertificate || '')
    } else {
      setError(null)
      setDomainName('')
      setSslPrivateKey('')
      setSslCertificate('')
      setShowDeleteConfirm(false)
    }
  }, [domain])

  const onClose = () => {
    if (!loading) {
      setDomainName('')
      setSslPrivateKey('')
      setSslCertificate('')
      setError(null)
      setShowDeleteConfirm(false)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isDomain(domainName))
      return setError(
        `A valid domain is required! Please enter a valid domain name (e.g., example.com)`
      )

    setError(null)
    setLoading(true)

    let result: { error?: Error } | undefined

    if (isEditMode && domain) {
      const updateData: Partial<Domain> = {
        domain: domainName.trim(),
      }

      const key = sslPrivateKey.trim()
      if (key) updateData.sslPrivateKey = key

      const cert = sslCertificate.trim()
      if (cert) updateData.sslCertificate = cert

      result = await updateDomain(domain.id, updateData)
    } else {
      const params: Partial<Domain> = {
        domain: domainName.trim(),
      }

      const key = sslPrivateKey.trim()
      if (key) params.sslPrivateKey = key

      const cert = sslCertificate.trim()
      if (cert) params.sslCertificate = cert

      if (projectId) {
        params.projectId = projectId
      } else if (orgId) {
        params.orgId = orgId
      }

      result = await createDomain(params)
    }

    setLoading(false)

    if (result?.error) {
      const action = isEditMode ? `update` : `create`
      const msg = result.error?.message || `Please try again.`
      setError(`Failed to ${action} domain. ${msg}`)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const onDelete = async () => {
    if (!domain) return

    setLoading(true)
    setError(null)

    const result = await deleteDomain(domain.id)

    setLoading(false)

    if (result.error) {
      setShowDeleteConfirm(false)
      const msg = result.error?.message || `Please try again.`
      setError(`Failed to delete domain. ${msg}`)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? `Edit Domain` : `Add New Domain`}
      actionsSx={
        isEditMode ? { justifyContent: `space-between`, px: 3, pb: 2 } : undefined
      }
      actions={
        <>
          {isEditMode && (
            <Button
              color='error'
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading || showDeleteConfirm}
            >
              Delete
            </Button>
          )}
          <Box sx={{ display: `flex`, gap: 1, ml: isEditMode ? `auto` : 0 }}>
            <Button
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <LoadingButton
              type='submit'
              form='domain-form'
              variant='contained'
              loading={loading}
              disabled={isEditMode && showDeleteConfirm}
              loadingText={isEditMode ? `Saving...` : `Adding...`}
            >
              {isEditMode ? `Save Changes` : `Add Domain`}
            </LoadingButton>
          </Box>
        </>
      }
    >
      <form
        id='domain-form'
        onSubmit={onSubmit}
      >
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          {isEditMode && showDeleteConfirm && (
            <ConfirmDelete
              deleting={loading}
              onConfirm={onDelete}
              onCancel={() => setShowDeleteConfirm(false)}
              itemName={domain?.domain || ''}
            />
          )}

          <TextInput
            required
            fullWidth
            autoFocus
            value={domainName}
            disabled={loading}
            label='Domain Name'
            id='tdsk-domain-name-input'
            placeholder='e.g., example.com or api.example.com'
            onChange={(e) => setDomainName(e.target.value)}
          />

          {!isEditMode && (
            <Box>
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{ display: 'block', mb: 1 }}
              >
                After adding your domain, you&apos;ll need to configure its DNS records to
                point to our servers. SSL certificates will be automatically provisioned.
              </Typography>
            </Box>
          )}

          {isEditMode && (
            <>
              <TextInput
                fullWidth
                textarea
                minRows={3}
                value={sslPrivateKey}
                disabled={loading}
                label='SSL Private Key'
                id='tdsk-ssl-private-key-input'
                placeholder='Paste SSL private key (optional)'
                onChange={(e) => setSslPrivateKey(e.target.value)}
              />

              <TextInput
                fullWidth
                textarea
                minRows={3}
                value={sslCertificate}
                disabled={loading}
                label='SSL Certificate'
                id='tdsk-ssl-certificate-input'
                placeholder='Paste SSL certificate (optional)'
                onChange={(e) => setSslCertificate(e.target.value)}
              />
            </>
          )}
        </Box>
      </form>
    </Drawer>
  )
}
