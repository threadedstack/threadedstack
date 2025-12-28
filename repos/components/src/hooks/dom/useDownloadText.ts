import { useCallback } from 'react'

export type THDownloadContent = {
  name?: string
  content?: string
  contentType?: string
}

const createLink = (props: THDownloadContent) => {
  const { name, content, contentType = `data:text/plain;charset=utf-8,` } = props

  const element = document.createElement(`a`)
  element.setAttribute(`href`, contentType + encodeURIComponent(content))
  element.setAttribute(`download`, name)
  element.style.display = `none`

  return element
}

const download = (element: HTMLElement) => {
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

export const useDownloadText = (props: THDownloadContent = {}) => {
  const onDownloadText = useCallback(
    (args: THDownloadContent) => download(createLink({ ...props, ...args })),
    [props?.name, props?.content]
  )

  return { onDownloadText }
}
