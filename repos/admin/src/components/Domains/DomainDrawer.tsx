import type { Domain } from '@tdsk/domain'

import { isDomain } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { Upload as UploadIcon } from '@mui/icons-material'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { ConfirmDelete, Drawer, TextInput } from '@tdsk/components'
import { Box, Button, Typography, IconButton } from '@mui/material'
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
      const updateData: Partial<Domain> = { domain: domainName.trim() }

      const key = sslPrivateKey.trim()
      if (key) updateData.sslPrivateKey = key

      const cert = sslCertificate.trim()
      if (cert) updateData.sslCertificate = cert

      result = await updateDomain(domain.id, updateData)
    } else {
      const params: Partial<Domain> = { domain: domainName.trim() }

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

  const onCertificateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        setSslCertificate(content)
      }
    }
    reader.onerror = () => setError(`Failed to read certificate file. Please try again.`)
    reader.readAsText(file)
  }

  const onPrivateKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        setSslPrivateKey(content)
      }
    }
    reader.onerror = () => setError(`Failed to read private key file. Please try again.`)
    reader.readAsText(file)
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

          {isEditMode && (
            <>
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
                        type='file'
                        accept='.crt,.pem,.cert'
                        hidden
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
                  Upload a .crt, .pem, or .cert file, or paste the certificate content
                  above
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </form>
    </Drawer>
  )
}
