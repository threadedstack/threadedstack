import {
  EmptyContainer,
  EmptyContent,
  EmptyIcon,
  EmptyText,
  EmptyTitle,
} from '@TSC/components/Empty/Empty.styles'
import { cls } from '@keg-hub/jsutils/cls'
import { isStr } from '@keg-hub/jsutils/isStr'
import type { SxProps, Theme } from '@mui/material'
import type { ReactNode } from 'react'

export type TEmpty = {
  sx?: SxProps<Theme>
  icon?: ReactNode
  title?: ReactNode
  className?: string
  content?: ReactNode
  textSx?: SxProps<Theme>
  titleSx?: SxProps<Theme>
  contentSx?: SxProps<Theme>
}

export const Empty = (props: TEmpty) => {
  const {
    sx,
    title = `Empty`,
    content,
    textSx,
    titleSx,
    className,
    contentSx,
    icon = <EmptyIcon />,
  } = props

  return (
    <EmptyContainer
      sx={sx}
      className={cls(`tdsk-empty-container`, className)}
    >
      <EmptyTitle
        sx={titleSx}
        className='tdsk-empty-title'
      >
        {icon}
        {title}
      </EmptyTitle>
      {isStr(content) ? (
        <EmptyContent
          sx={contentSx}
          className='tdsk-empty'
        >
          <EmptyText
            sx={textSx}
            className='tdsk-empty-text'
          >
            {content}
          </EmptyText>
        </EmptyContent>
      ) : (
        content || null
      )}
    </EmptyContainer>
  )
}
