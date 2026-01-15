import { Box, Card, CardContent, Divider, Typography } from '@mui/material'
import { ClipboardCopy, useCopyToClipboard } from '@tdsk/components'

export type TInfoItem = {
  label: string
  value: string
  copyable?: boolean
  isDate?: boolean
}

export type TInfoCard = {
  title: string
  items: TInfoItem[]
  onCopy?: (message: string) => void
}

const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleString()
}

/**
 * InfoCard - Displays a list of label-value pairs with optional copy functionality
 * Uses ClipboardCopy and useCopyToClipboard from @tdsk/components
 */
export const InfoCard = ({ title, items, onCopy }: TInfoCard) => {
  const { onCopyToClipBoard } = useCopyToClipboard()

  const handleCopy = (text: string) => {
    onCopyToClipBoard(text)
    onCopy?.('Copied to clipboard')
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant='h6'>{title}</Typography>
        <Divider sx={{ my: 2 }} />
        {items.map((item, index) => (
          <Box
            key={item.label}
            sx={{ mb: index === items.length - 1 ? 0 : 2 }}
          >
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              {item.label}
            </Typography>
            {item.copyable ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant='body2'
                  fontFamily='monospace'
                >
                  {item.isDate ? formatDate(item.value) : item.value}
                </Typography>
                <ClipboardCopy value={item.value} />
              </Box>
            ) : (
              <Typography variant='body2'>
                {item.isDate ? formatDate(item.value) : item.value}
              </Typography>
            )}
          </Box>
        ))}
      </CardContent>
    </Card>
  )
}
