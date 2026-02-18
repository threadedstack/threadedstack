import type { Function as FunctionModel } from '@tdsk/domain'
import { Grid } from '@mui/material'
import { FunctionCard } from './FunctionCard'

export type TFunctionsGrid = {
  functions: FunctionModel[]
  onEdit: (func: FunctionModel) => void
  onDelete: (id: string, name: string) => void
}

export const FunctionsGrid = ({ functions, onEdit, onDelete }: TFunctionsGrid) => {
  return (
    <Grid
      container
      spacing={3}
    >
      {functions.map((func) => (
        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          key={func.id}
        >
          <FunctionCard
            func={func}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </Grid>
      ))}
    </Grid>
  )
}
