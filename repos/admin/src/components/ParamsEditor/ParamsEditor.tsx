import type { TFunctionParam, TFunParamType } from '@tdsk/domain'

import { EFunParamType } from '@tdsk/domain'
import { TextInput, SelectInput } from '@tdsk/components'
import { Box, Checkbox, FormControlLabel } from '@mui/material'
import { EditorList } from '@TAF/components/EditorList/EditorList'

export type TParamRow = TFunctionParam & { id: string }

const ParamTypeItems = Object.values(EFunParamType).map((v) => ({
  label: v.charAt(0).toUpperCase() + v.slice(1),
  value: v,
}))

const rowBase = { flex: 1, gap: 1, display: `flex`, alignItems: `center` } as const

const styles = {
  row1: rowBase,
  row2: { ...rowBase, mt: 0.5 },
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

  const removeParam = (index: number) => {
    const id = params[index]?.id
    onChange(params.filter((p) => p.id !== id))
  }

  const updateParam = (id: string, field: string, value: any) =>
    onChange(params.map((p) => (p.id === id ? { ...p, [field]: value } : p)))

  return (
    <EditorList
      label={label}
      disabled={disabled}
      onAdd={addParam}
      onRemove={removeParam}
      addTooltip='Add parameter'
      removeTooltip='Remove parameter'
      emptyMessage='No parameters defined. Click + to add one.'
      items={params.map((param) => ({
        key: param.id,
        content: (
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
                    onChange={(e) => updateParam(param.id, `required`, e.target.checked)}
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
                  onChange={(e) => updateParam(param.id, `description`, e.target.value)}
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
        ),
      }))}
    />
  )
}
