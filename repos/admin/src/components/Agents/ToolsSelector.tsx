import { AvailableTools } from '@TAF/constants/tools'
import { Box, Chip, TextField, Typography, Autocomplete } from '@mui/material'

export type TToolsSelector = {
  loading: boolean
  selectedTools: string[]
  onChange: (tools: string[]) => void
}

export const ToolsSelector = (props: TToolsSelector) => {
  const { loading, onChange, selectedTools } = props

  return (
    <Box>
      <Typography
        variant='subtitle2'
        sx={{ fontWeight: 600, mb: 2 }}
      >
        Available Tools
      </Typography>
      <Autocomplete
        multiple
        value={selectedTools}
        disabled={loading}
        noOptionsText='No tools available'
        options={AvailableTools.map((t) => t.value)}
        onChange={(_, updates) => onChange(updates)}
        getOptionLabel={(option) => {
          const tool = AvailableTools.find((t) => t.value === option)
          return tool ? tool.label : option
        }}
        renderTags={(tagValue, getTagProps) =>
          tagValue.map((option, index) => {
            const tool = AvailableTools.find((t) => t.value === option)
            return (
              <Chip
                key={option}
                variant='outlined'
                label={tool?.label || option}
                {...getTagProps({ index })}
              />
            )
          })
        }
        renderOption={(props, option) => {
          const tool = AvailableTools.find((t) => t.value === option)
          return (
            <li
              {...props}
              key={option}
            >
              <Box>
                <Typography
                  variant='body2'
                  fontWeight='medium'
                >
                  {tool?.label}
                </Typography>
                <Typography
                  variant='caption'
                  color='text.secondary'
                >
                  {tool?.description}
                </Typography>
              </Box>
            </li>
          )
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label='Tools'
            placeholder='Select tools for this agent'
            helperText='Choose which tools this agent can use'
          />
        )}
      />
    </Box>
  )
}
