import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  TextField,
  Typography,
} from '@mui/material'

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
            <TextField
              key={field.name}
              fullWidth
              label={field.label}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              multiline={field.multiline}
              rows={field.rows}
              placeholder={field.placeholder}
            />
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant='contained'
              onClick={onSave}
              disabled={!hasChanges || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
