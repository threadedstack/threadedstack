import { colors } from '@TSC/theme/colors'
import { TSIcon } from '@TSC/components/Icons'
import { LogoContainer, LogoBtn, LogoText } from '@TSC/components/Header/Header.styled'

const style = {
  width: `28px`,
  height: `28px`,
  fill: colors.primary.main,
}

export type TAppLogo = {
  full?: boolean
  onNavigate?: () => void
}

export const AppLogo = (props: TAppLogo) => {
  const { full, onNavigate } = props

  return (
    <LogoContainer className='tdsk-logo-icon-container'>
      <LogoBtn
        className='tdsk-logo-icon-button'
        onClick={onNavigate}
      >
        <TSIcon svgStyle={style} />
        {full && (
          <LogoText
            noWrap
            variant='h6'
            component='a'
          >
            Threaded Stack
          </LogoText>
        )}
      </LogoBtn>
    </LogoContainer>
  )
}
