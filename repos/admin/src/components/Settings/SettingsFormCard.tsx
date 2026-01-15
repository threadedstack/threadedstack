import { Box, Card, CardContent, Divider, Typography } from '@mui/material'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { TextInput } from '@tdsk/components'

export type TFormField = {
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
}

export type TSettingsFormCard = {
  title?: string
  fields: TFormField[]
  onSave: () => void
  hasChanges: boolean
  saving: boolean
}

export const SettingsFormCard = ({
  title = 'General Settings',
  fields,
  onSave,
  hasChanges,
  saving,
}: TSettingsFormCard) => {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant='h6'>{title}</Typography>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {fields.map((field) => (
            <TextInput
              key={field.name}
              name={field.name}
              fullWidth
              label={field.label}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              textarea={field.multiline}
              minRows={field.rows}
              maxRows={field.rows}
              placeholder={field.placeholder}
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
