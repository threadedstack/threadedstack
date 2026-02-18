import type { Function as FunctionModel } from '@tdsk/domain'
import { Code as CodeIcon, Delete as DeleteIcon } from '@mui/icons-material'
import {
  Box,
  Card,
  Chip,
  Button,
  Tooltip,
  IconButton,
  Typography,
  CardContent,
  CardActions,
} from '@mui/material'

export type TFunctionCard = {
  func: FunctionModel
  onEdit: (func: FunctionModel) => void
  onDelete: (id: string, name: string) => void
}

export const FunctionCard = ({ func, onEdit, onDelete }: TFunctionCard) => {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
      }}
      onClick={() => onEdit(func)}
    >
      <CardContent sx={{ flex: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2,
          }}
        >
          <CodeIcon color='primary' />
          <Typography
            variant='h6'
            component='div'
            noWrap
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {func.name}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography
            variant='caption'
            color='text.secondary'
            display='block'
          >
            Language
          </Typography>
          <Chip
            label={func.language}
            size='small'
            color='primary'
            variant='outlined'
            sx={{ mt: 0.5 }}
          />
        </Box>

        {func.endpointId && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant='caption'
              color='text.secondary'
              display='block'
            >
              Endpoint
            </Typography>
            <Typography
              variant='body2'
              fontFamily='monospace'
              sx={{ wordBreak: 'break-all', mt: 0.5 }}
            >
              {func.endpointId}
            </Typography>
          </Box>
        )}

        {func.createdAt && (
          <Box>
            <Typography
              variant='caption'
              color='text.secondary'
              display='block'
            >
              Created
            </Typography>
            <Typography
              variant='body2'
              sx={{ mt: 0.5 }}
            >
              {new Date(func.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
        )}
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0 }}>
        <Button
          size='small'
          onClick={(e) => {
            e.stopPropagation()
            onEdit(func)
          }}
        >
          Edit
        </Button>
        <Tooltip title='Delete function'>
          <IconButton
            size='small'
            color='error'
            sx={{ minHeight: 44, minWidth: 44 }}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(func.id, func.name)
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  )
}
