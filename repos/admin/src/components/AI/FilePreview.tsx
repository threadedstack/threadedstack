import { Box, Chip, Typography } from '@mui/material'
import {
  Close as CloseIcon,
  Image as ImageIcon,
  Code as CodeIcon,
  Description as FileIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material'

export type TPendingFile = {
  file: File
  id: string
}

export type TFilePreviewProps = {
  files: TPendingFile[]
  onRemove: (id: string) => void
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith(`image/`)) return <ImageIcon sx={{ fontSize: 16 }} />
  if (mimeType === `application/pdf`) return <PdfIcon sx={{ fontSize: 16 }} />
  if (
    mimeType.includes(`javascript`) ||
    mimeType.includes(`typescript`) ||
    mimeType.includes(`json`)
  )
    return <CodeIcon sx={{ fontSize: 16 }} />
  return <FileIcon sx={{ fontSize: 16 }} />
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export const FilePreview = (props: TFilePreviewProps) => {
  const { files, onRemove } = props

  if (files.length === 0) return null

  return (
    <Box sx={{ display: `flex`, gap: 0.5, flexWrap: `wrap`, px: 2, pt: 1 }}>
      {files.map((pf) => (
        <Chip
          key={pf.id}
          size='small'
          icon={getFileIcon(pf.file.type)}
          label={
            <Typography
              variant='caption'
              noWrap
              sx={{ maxWidth: 150 }}
            >
              {pf.file.name} ({formatSize(pf.file.size)})
            </Typography>
          }
          onDelete={() => onRemove(pf.id)}
          deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
          variant='outlined'
          sx={{ maxWidth: 220 }}
        />
      ))}
    </Box>
  )
}
