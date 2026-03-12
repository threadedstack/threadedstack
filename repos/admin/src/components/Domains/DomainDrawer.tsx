import type { Domain } from '@tdsk/domain'

import { isDomain } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { Upload as UploadIcon } from '@mui/icons-material'
import { Box, Typography, IconButton } from '@mui/material'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { ConfirmDelete, Drawer, DrawerActions, TextInput } from '@tdsk/components'
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
    setError(null)
    setShowDeleteConfirm(false)
    setDomainName(domain?.domain || '')
    setSslPrivateKey(domain?.sslPrivateKey || '')
    setSslCertificate(domain?.sslCertificate || '')
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

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!isDomain(domainName))
      return setError(
        `A valid domain is required! Please enter a valid domain name (e.g., example.com)`
      )

    setError(null)
    setLoading(true)

    let result: { error?: Error } | undefined

    const params: Partial<Domain> = { domain: domainName.trim() }
    const key = sslPrivateKey.trim()
    if (key) params.sslPrivateKey = key

    const cert = sslCertificate.trim()
    if (cert) params.sslCertificate = cert

    if (isEditMode && domain) {
      result = await updateDomain({ orgId, id: domain.id, data: params, projectId })
    } else {
      result = await createDomain({ orgId, data: params, projectId })
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

  const onRemove = async () => {
    if (!domain) return

    setLoading(true)
    setError(null)

    const result = await deleteDomain({ orgId, id: domain.id, projectId })

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

  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove,
  })

  const onFileUpload =
    (setter: (v: string) => void, label: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        if (content) setter(content)
      }
      reader.onerror = () => setError(`Failed to read ${label} file. Please try again.`)
      reader.readAsText(file)
    }

  const onCertificateFileUpload = onFileUpload(setSslCertificate, 'certificate')
  const onPrivateKeyFileUpload = onFileUpload(setSslPrivateKey, 'private key')

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? `Edit Domain` : `Add New Domain`}
      actions={
        <DrawerActions
          form='domain-form'
          actions={actions}
          loading={loading}
          editing={isEditMode}
          disabled={loading || showDeleteConfirm}
        />
      }
    >
      <form id='domain-form'>
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
              onConfirm={onRemove}
              itemName={domain?.domain || ''}
              onCancel={() => setShowDeleteConfirm(false)}
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
                After adding your domain, you'll need to configure its DNS records to
                point to our servers. SSL certificates will be automatically provisioned
                using{' '}
                <a
                  href='https://letsencrypt.org/'
                  target='_blank'
                  rel='noopener'
                >
                  Let's Encrypt
                </a>
                . Or upload them manually to use existing SSL certificates.
              </Typography>
            </Box>
          )}

          <Box>
            <TextInput
              fullWidth
              textarea
              minRows={3}
              disabled={loading}
              value={sslPrivateKey}
              label='SSL Private Key'
              id='tdsk-ssl-private-key-input'
              placeholder='Paste SSL private key (optional) or upload file'
              onChange={(e) => setSslPrivateKey(e.target.value)}
              endAdornment={
                <IconButton
                  component='label'
                  disabled={loading}
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                  <UploadIcon />
                  <input
                    type='file'
                    accept='.key,.pem'
                    hidden
                    onChange={onPrivateKeyFileUpload}
                  />
                </IconButton>
              }
            />
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ display: 'block', mt: 0.5 }}
            >
              Upload a .key or .pem file, or paste the private key content above
            </Typography>
          </Box>

          <Box>
            <TextInput
              fullWidth
              textarea
              minRows={3}
              disabled={loading}
              value={sslCertificate}
              label='SSL Certificate'
              id='tdsk-ssl-certificate-input'
              placeholder='Paste SSL certificate (optional) or upload file'
              onChange={(e) => setSslCertificate(e.target.value)}
              endAdornment={
                <IconButton
                  component='label'
                  disabled={loading}
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                  <UploadIcon />
                  <input
                    hidden
                    type='file'
                    accept='.crt,.pem,.cert'
                    onChange={onCertificateFileUpload}
                  />
                </IconButton>
              }
            />
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ display: 'block', mt: 0.5 }}
            >
              Upload a .crt, .pem, or .cert file, or paste the certificate content above
            </Typography>
          </Box>
        </Box>
      </form>
    </Drawer>
  )
}
