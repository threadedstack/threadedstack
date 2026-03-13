import { useCallback, useState } from 'react'

type CopyFn = (text: string) => Promise<boolean>

const useClipboardCopy = (): CopyFn => {
  return useCallback(async (text) => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported')
      return false
    }

    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.warn('Copy failed', error)
      return false
    }
  }, [])
}

export type THCopyToClipBoard = {
  value?: string
}

export const useCopyToClipboard = (props: THCopyToClipBoard = {}) => {
  const { value } = props
  const copy = useClipboardCopy()
  const [isCopied, setIsCopied] = useState(false)

  const onCopyToClipBoard = (val?: any) => {
    const toCopy = val || value
    toCopy &&
      copy(toCopy)
        .then(() => setIsCopied(true))
        .catch((err) => {
          console.log(`An error occurred while copying: `, err)
          return err
        })
  }

  const onCopiedOff = () => setIsCopied(false)

  return {
    isCopied,
    onCopiedOff,
    onCopyToClipBoard,
  }
}
