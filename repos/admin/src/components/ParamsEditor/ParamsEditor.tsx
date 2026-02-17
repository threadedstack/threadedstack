import type { TFunctionParam, TFunParamType } from '@tdsk/domain'

import { EFunParamType } from '@tdsk/domain'
import { TextInput, SelectInput } from '@tdsk/components'
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import {
  Box,
  Paper,
  Tooltip,
  Checkbox,
  IconButton,
  Typography,
  FormControlLabel,
} from '@mui/material'

export type TParamRow = TFunctionParam & { id: string }

const ParamTypeItems = Object.values(EFunParamType).map((v) => ({
  label: v.charAt(0).toUpperCase() + v.slice(1),
  value: v,
}))

const styles = {
  title: { fontWeight: 600 },
  add: { color: `primary.main` },
  container: {
    mb: 1,
    display: `flex`,
    alignItems: `center`,
    justifyContent: `space-between`,
  },
  items: {
    remove: { color: `error.main`, mt: 0.5 },
    container: { display: `flex`, flexDirection: `column`, gap: 1.5 },
    nopaper: {
      p: 3,
      textAlign: `center`,
      bgcolor: `action.hover`,
    },
    paper: {
      p: 1.5,
      gap: 1,
      display: `flex`,
      alignItems: `flex-start`,
    },
  },
  row1: {
    flex: 1,
    gap: 1,
    display: `flex`,
    alignItems: `center`,
  },
  row2: {
    flex: 1,
    gap: 1,
    display: `flex`,
    alignItems: `center`,
    mt: 0.5,
  },
}

export type TParamsEditorProps = {
  label?: string
  disabled?: boolean
  params: TParamRow[]
  onChange: (params: TParamRow[]) => void
}

export const ParamsEditor = (props: TParamsEditorProps) => {
  const { params, disabled, onChange, label = `Input Parameters` } = props

  const addParam = () => {
    onChange([
      ...params,
      {
        name: ``,
        description: ``,
        required: false,
        id: `param-${Date.now()}`,
        type: `string` as TFunParamType,
      },
    ])
  }

  const removeParam = (id: string) => onChange(params.filter((p) => p.id !== id))

  const updateParam = (id: string, field: string, value: any) =>
    onChange(params.map((p) => (p.id === id ? { ...p, [field]: value } : p)))

  return (
    <Box>
      <Box sx={styles.container}>
        <Typography
          variant='subtitle2'
          sx={styles.title}
        >
          {label}
        </Typography>
        <Tooltip title='Add parameter'>
          <IconButton
            size='small'
            sx={styles.add}
            onClick={addParam}
            disabled={disabled}
          >
            <AddIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      </Box>

      {params.length === 0 ? (
        <Paper
          variant='outlined'
          sx={styles.items.nopaper}
        >
          <Typography
            variant='body2'
            color='text.secondary'
          >
            No parameters defined. Click + to add one.
          </Typography>
        </Paper>
      ) : (
        <Box sx={styles.items.container}>
          {params.map((param) => (
            <Paper
              key={param.id}
              variant='outlined'
              sx={styles.items.paper}
            >
              <Box sx={{ flex: 1, display: `flex`, flexDirection: `column` }}>
                <Box sx={styles.row1}>
                  <Box sx={{ flex: 2 }}>
                    <TextInput
                      fullWidth
                      size='small'
                      value={param.name}
                      disabled={disabled}
                      id={`${param.id}-name`}
                      placeholder='Parameter name'
                      onChange={(e) => updateParam(param.id, `name`, e.target.value)}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <SelectInput
                      size='small'
                      value={param.type}
                      disabled={disabled}
                      items={ParamTypeItems}
                      id={`${param.id}-type`}
                      onChange={(e) => updateParam(param.id, `type`, e.target.value)}
                    />
                  </Box>
                  <FormControlLabel
                    label='Required'
                    slotProps={{ typography: { variant: `caption` } }}
                    control={
                      <Checkbox
                        size='small'
                        disabled={disabled}
                        checked={param.required || false}
                        onChange={(e) =>
                          updateParam(param.id, `required`, e.target.checked)
                        }
                      />
                    }
                  />
                </Box>
                <Box sx={styles.row2}>
                  <Box sx={{ flex: 2 }}>
                    <TextInput
                      fullWidth
                      size='small'
                      disabled={disabled}
                      value={param.description || ``}
                      id={`${param.id}-description`}
                      placeholder='Description (helps the LLM)'
                      onChange={(e) =>
                        updateParam(param.id, `description`, e.target.value)
                      }
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <TextInput
                      fullWidth
                      size='small'
                      disabled={disabled}
                      id={`${param.id}-default`}
                      placeholder='Default value'
                      value={param.default != null ? String(param.default) : ``}
                      onChange={(e) =>
                        updateParam(param.id, `default`, e.target.value || undefined)
                      }
                    />
                  </Box>
                </Box>
              </Box>
              <Tooltip title='Remove parameter'>
                <IconButton
                  size='small'
                  disabled={disabled}
                  sx={styles.items.remove}
                  onClick={() => removeParam(param.id)}
                >
                  <DeleteIcon fontSize='small' />
                </IconButton>
              </Tooltip>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  )
}
