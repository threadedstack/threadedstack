import { ComponentProps } from 'react'
import Box from '@mui/material/Box'
import { cls } from '@keg-hub/jsutils/cls'
import { styled } from '@mui/material/styles'
import { Image as MuiImage } from 'mui-image-alter'

export type TImage = ComponentProps<typeof MuiImage> & {
  
}

// Fixes a bug in the mui-image-alter package
const ImgContainer = styled(Box)`
  & .MuiImageAlter-wrapper.tdsk-image-wrapper {
    height: 100% !important;
    width: 100% !important; 
  }
`


export const Image = (props:TImage) => {
  const { wrapperClassName, className, ...rest } = props
  
  return (
    <ImgContainer
      className='tdsk-image-container'
    >
      <MuiImage
        {...rest}
        className={cls(className, `tdsk-image`)}
        wrapperClassName={cls(`tdsk-image-wrapper`, wrapperClassName)}
      />
    </ImgContainer>
  )
}
