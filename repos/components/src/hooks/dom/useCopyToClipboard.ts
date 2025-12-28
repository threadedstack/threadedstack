import { useCallback, useState } from 'react'

type CopiedValue = string | null
type CopyFn = (text: string) => Promise<boolean>


const useClipboardCopy = (): [CopiedValue, CopyFn] => {
  const [copiedText, setCopiedText] = useState<CopiedValue>(null)

  const copy: CopyFn = useCallback(async text => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported')
      return false
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      return true
    }
    catch (error) {
      console.warn('Copy failed', error)
      setCopiedText(null)
      return false
    }
  }, [])

  return [copiedText, copy]
}

export type THCopyToClipBoard = {
  value?: string
}

export const useCopyToClipboard = (props: THCopyToClipBoard = {}) => {
  const { value } = props
  const [_, copy] = useClipboardCopy()
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
