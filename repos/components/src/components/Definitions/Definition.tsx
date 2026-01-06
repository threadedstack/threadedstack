import { cls } from '@keg-hub/jsutils/cls'
import { isUrl } from '@keg-hub/jsutils/isUrl'
import { InlineDom } from '@TSC/components/InlineDom/InlineDom'
import {
  DefText,
  DefButton,
  DefContainer,
  DefIconImage,
  DefIconContainer,
} from '@TSC/components/Definitions/Definitions.styles'

type TIconObj = {
  icon?: string
  color?: string
  hidden?: boolean
  [key: string]: any
}

export type TDef = {
  id?: string
  name?: string
  type?: string
  owner?: string[]
  groups?: string[]
  parents?: string[]
  disabled?: boolean
  description?: string
  editor: {
    icon?: string
    color?: string
    canvas?: TIconObj
    sidebar?: TIconObj
  }
}

export type TDefinition<T extends TDef = TDef> = {
  definition: T
  onClick?: (definition: T) => void
}

export const Definition = <T extends TDef = TDef>(props: TDefinition<T>) => {
  const { onClick, definition } = props

  const icon =
    definition?.editor?.sidebar?.icon ||
    definition?.editor?.canvas?.icon ||
    definition?.editor?.icon

  const color =
    definition?.editor?.sidebar?.color ||
    definition?.editor?.canvas?.color ||
    definition?.editor?.color

  return (
    <DefContainer
      className='tdsk-def-container'
      draggable={!definition?.disabled}
    >
      <DefButton
        iconColor={color}
        tooltip={definition.description}
        onClick={() => onClick?.(definition)}
        className={cls(`tdsk-def-button`, definition.disabled && `disabled`)}
      >
        <DefIconContainer className='tdsk-def-icon-container'>
          {isUrl(icon) ? (
            <DefIconImage
              src={icon}
              duration={0}
            />
          ) : (
            <InlineDom html={icon} />
          )}
        </DefIconContainer>
        <DefText>{definition.name || definition.type}</DefText>
      </DefButton>
    </DefContainer>
  )
}
