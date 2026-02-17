import { useCallback, useEffect, useState } from 'react'

import { Page } from '@TAF/pages/Page/Page'
import { EThemeType } from '@TAF/types'
import { useOrgs } from '@TAF/state/selectors'
import { storage } from '@TAF/services/storage'
import { SettingsStorageKey } from '@TAF/constants/storage'
import { useThemeToggle } from '@TAF/hooks/theme/useThemeToggle'
import {
  Box,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
} from '@mui/material'

type TSettingsData = {
  defaultOrgId: string
  emailNotifications: boolean
  agentRunNotifications: boolean
  securityAlerts: boolean
}

const defaultSettings: TSettingsData = {
  defaultOrgId: ``,
  emailNotifications: true,
  agentRunNotifications: false,
  securityAlerts: true,
}

const loadSettings = (): TSettingsData => {
  const saved = storage.get<TSettingsData>(SettingsStorageKey)
  return saved ? { ...defaultSettings, ...saved } : defaultSettings
}

const saveSettings = (data: TSettingsData) => {
  storage.set<TSettingsData>(SettingsStorageKey, data)
}

export type TSettings = {}

export const Settings = (props: TSettings) => {
  const { themeType, onThemeToggle } = useThemeToggle()
  const [orgs] = useOrgs()
  const [settings, setSettings] = useState<TSettingsData>(loadSettings)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const onSettingChange = useCallback(
    <K extends keyof TSettingsData>(key: K, value: TSettingsData[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  return (
    <Page className='tdsk-settings-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          Settings
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant='h6'>Appearance</Typography>
          <Divider sx={{ my: 2 }} />
          <FormControlLabel
            label='Dark Mode'
            control={
              <Switch
                checked={themeType === EThemeType.dark}
                onChange={() => onThemeToggle()}
              />
            }
          />
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ ml: 6 }}
          >
            {themeType === EThemeType.dark ? `Using dark theme` : `Using light theme`}
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant='h6'>Default Organization</Typography>
          <Divider sx={{ my: 2 }} />
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ mb: 1.5 }}
          >
            Select the organization to load by default when opening the dashboard.
          </Typography>
          <Select
            fullWidth
            size='small'
            displayEmpty
            value={settings.defaultOrgId}
            onChange={(e) => onSettingChange(`defaultOrgId`, e.target.value)}
          >
            <MenuItem value=''>
              <em>None (use last visited)</em>
            </MenuItem>
            {Object.values(orgs ?? {}).map((org) => (
              <MenuItem
                key={org.id}
                value={org.id}
              >
                {org.name}
              </MenuItem>
            ))}
          </Select>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant='h6'>Notifications</Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
            <FormControlLabel
              label='Email Notifications'
              control={
                <Switch
                  checked={settings.emailNotifications}
                  onChange={(e) =>
                    onSettingChange(`emailNotifications`, e.target.checked)
                  }
                />
              }
            />
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{ ml: 6, mt: -1 }}
            >
              Receive email updates about your account and organizations.
            </Typography>

            <FormControlLabel
              label='Agent Run Notifications'
              control={
                <Switch
                  checked={settings.agentRunNotifications}
                  onChange={(e) =>
                    onSettingChange(`agentRunNotifications`, e.target.checked)
                  }
                />
              }
            />
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{ ml: 6, mt: -1 }}
            >
              Get notified when agent runs complete or encounter errors.
            </Typography>

            <FormControlLabel
              label='Security Alerts'
              control={
                <Switch
                  checked={settings.securityAlerts}
                  onChange={(e) => onSettingChange(`securityAlerts`, e.target.checked)}
                />
              }
            />
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{ ml: 6, mt: -1 }}
            >
              Receive alerts about suspicious activity and security events.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Page>
  )
}

export default Settings
