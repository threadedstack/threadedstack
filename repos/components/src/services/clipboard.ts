export type TClipBoardCopy = {
  key?: string
  warn?: boolean
  content?: string
  element?: HTMLElement
  callback?: (...args: any[]) => any
}

const noContentWarn = (warn: boolean, callback?: (...args: any[]) => any) => {
  warn && console.warn(`No content was found to copy to the clipboard`)
  callback?.(false)
}

export const copyToClipboard = async ({
  element,
  content,
  callback,
  warn = true,
  key = `innerText`,
}: TClipBoardCopy) => {
  const data = content || element?.[key as keyof typeof element]
  if (!data) return noContentWarn(warn, callback)

  await navigator.clipboard.writeText(data as string)
  callback?.(true, data)
  return true
}

export const copyText = async (content: string) => copyToClipboard({ content })

export const clipboard = {
  copyText,
  copy: copyToClipboard,
}
