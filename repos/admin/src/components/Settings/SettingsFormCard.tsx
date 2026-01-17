import { TextInput } from '@tdsk/components'
import { Box, Card, CardContent, Divider, Typography } from '@mui/material'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'

export type TFormField = {
  name: string
  label: string
  value: string
  rows?: number
  multiline?: boolean
  placeholder?: string
  onChange: (value: string) => void
}

export type TSettingsFormCard = {
  title?: string
  saving: boolean
  onSave: () => void
  hasChanges: boolean
  fields: TFormField[]
}

export const SettingsFormCard = (props: TSettingsFormCard) => {
  const { fields, onSave, saving, hasChanges, title = `Settings` } = props

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant='h6'>{title}</Typography>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {fields.map((field) => (
            <TextInput
              fullWidth
              key={field.name}
              name={field.name}
              label={field.label}
              value={field.value}
              minRows={field.rows}
              maxRows={field.rows}
              textarea={field.multiline}
              placeholder={field.placeholder}
              id={`tdsk-settings-${field.name}`}
              onChange={(e) => field.onChange(e.target.value)}
            />
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <LoadingButton
              variant='contained'
              onClick={onSave}
              loading={saving}
              disabled={!hasChanges}
              loadingText='Saving...'
            >
              Save Changes
            </LoadingButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
