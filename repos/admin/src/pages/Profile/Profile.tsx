import type { User } from '@tdsk/domain'

import { Page } from '@TAF/pages/Page/Page'
import { useState } from 'react'
import { useUser } from '@TAF/state/selectors'
import { LoadingSpinner, ErrorAlert } from '@TAF/components'
import { getInitials } from '@TAF/utils/user/getInitials'
import { SettingsFormCard, InfoCard } from '@TAF/components/Settings'
import { updateProfile } from '@TAF/actions/profile/api/updateProfile'
import { Box, Alert, Typography, Avatar, Card, CardContent } from '@mui/material'

export type TProfile = {}

export const Profile = (props: TProfile) => {
  const [user] = useUser()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [localUser, setLocalUser] = useState<User>(user)

  const hasChanges =
    user?.first !== localUser?.first ||
    user?.last !== localUser?.last ||
    user?.image !== localUser?.image

  const onReset = () => setLocalUser(user)

  const onSave = async () => {
    if (!user?.id || !hasChanges) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const result = await updateProfile(user.id, localUser)
      if (result.error) {
        setError(result.error.message)
      } else {
        setSuccess(`Profile updated successfully`)
        setLocalUser(result.data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page className='tdsk-profile-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          Profile
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

      {!user && <LoadingSpinner />}

      {user && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  mb: 2,
                }}
              >
                <Avatar
                  src={user.image}
                  alt={user.displayName}
                  sx={{
                    width: 80,
                    height: 80,
                    fontSize: '2rem',
                  }}
                >
                  {getInitials(user)}
                </Avatar>
                <Box>
                  <Typography
                    variant='h6'
                    sx={{ mb: 0.5 }}
                  >
                    {user.displayName}
                  </Typography>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                  >
                    {user.email}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <SettingsFormCard
            saving={saving}
            onSave={onSave}
            onReset={onReset}
            hasChanges={hasChanges}
            title='Personal Information'
            fields={[
              {
                name: `first`,
                label: `First Name`,
                value: localUser?.first ?? ``,
                onChange: (first: string) =>
                  setLocalUser({ ...localUser, first } as User),
              },
              {
                name: `last`,
                label: `Last Name`,
                value: localUser?.last ?? ``,
                onChange: (last: string) => setLocalUser({ ...localUser, last } as User),
              },
              {
                name: `email`,
                label: `Email`,
                value: localUser?.email ?? ``,
                disabled: true,
                placeholder: 'user@example.com',
                onChange: (email: string) =>
                  setLocalUser({ ...localUser, email } as User),
              },
              {
                name: `image`,
                label: `Profile Image URL`,
                value: localUser?.image ?? ``,
                placeholder: `https://example.com/avatar.jpg`,
                onChange: (image: string) =>
                  setLocalUser({ ...localUser, image } as User),
              },
            ]}
          />

          <InfoCard
            title='Account Information'
            items={[
              { label: `User ID`, value: user.id, copyable: true },
              ...(user.provider
                ? [{ label: `Auth Provider`, value: user.provider }]
                : []),
              ...(user.emailVerified !== undefined
                ? [{ label: `Email Verified`, value: user.emailVerified ? 'Yes' : 'No' }]
                : []),
              ...(user.createdAt
                ? [{ label: `Member Since`, value: String(user.createdAt), isDate: true }]
                : []),
              ...(user.updatedAt
                ? [
                    {
                      label: `Last Updated`,
                      value: String(user.updatedAt),
                      isDate: true,
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}
    </Page>
  )
}

export default Profile
