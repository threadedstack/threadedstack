import { useState, useCallback } from 'react'
import { ContextLoader } from '@TRL/services/context'
import type { TContextFile } from '@TRL/types'

export function useContextFiles() {
  const [contextFiles, setContextFiles] = useState<TContextFile[]>([])

  const autoDetect = useCallback((cwd: string) => {
    const files = ContextLoader.autoDetect(cwd)
    setContextFiles(files)
  }, [])

  const addFile = useCallback((path: string) => {
    const file = ContextLoader.loadFile(path)
    if (file) {
      setContextFiles((prev) => [...prev, file])
    }
  }, [])

  const removeFile = useCallback((index: number) => {
    setContextFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return { contextFiles, autoDetect, addFile, removeFile }
}
