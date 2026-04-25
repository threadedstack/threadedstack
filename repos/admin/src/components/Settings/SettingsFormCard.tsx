import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'
import { TextInput, Button } from '@tdsk/components'
import { Box, Card, CardContent, Divider, Typography } from '@mui/material'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'

const styles = {
  card: { mb: 3 },
  divider: { my: 2 },
  inputs: {
    gap: 2,
    display: `flex`,
    flexDirection: `column`,
  },
  actions: {
    mt: 2,
    gap: 2,
    display: `flex`,
    justifyContent: `flex-end`,
  },
}

export type TFormField = {
  name: string
  label: string
  value: string
  rows?: number
  disabled?: boolean
  multiline?: boolean
  placeholder?: string
  onChange: (value: string) => void
}

export type TSettingsFormCard = {
  title?: string
  saving: boolean
  disabled?: boolean
  resetText?: string
  saveText?: string
  onSave: () => void
  onReset?: () => void
  hasChanges: boolean
  fields: TFormField[]
}

export const SettingsFormCard = (props: TSettingsFormCard) => {
  const {
    fields,
    onSave,
    onReset,
    saving,
    disabled,
    hasChanges,
    saveText = `Save`,
    resetText = `Reset`,
    title = `Settings`,
  } = props

  return (
    <Card sx={styles.card}>
      <CardContent>
        <Typography variant='h6'>{title}</Typography>
        <Divider sx={styles.divider} />
        <Box sx={styles.inputs}>
          {fields.map((field) => (
            <TextInput
              fullWidth
              key={field.name}
              name={field.name}
              label={field.label}
              value={field.value}
              minRows={field.rows}
              maxRows={field.rows}
              disabled={disabled || field.disabled}
              textarea={field.multiline}
              placeholder={field.placeholder}
              id={`tdsk-settings-${field.name}`}
              onChange={(e) => field.onChange(e.target.value)}
            />
          ))}
          <Box sx={styles.actions}>
            {onReset && (
              <Button
                color='warning'
                onClick={onReset}
                variant='outlined'
                Icon={<CancelIcon />}
                disabled={!hasChanges}
              >
                {resetText}
              </Button>
            )}

            <LoadingButton
              color='success'
              onClick={onSave}
              loading={saving}
              Icon={<SaveIcon />}
              variant='contained'
              disabled={disabled || !hasChanges}
              loadingText='Saving...'
            >
              {saveText}
            </LoadingButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
