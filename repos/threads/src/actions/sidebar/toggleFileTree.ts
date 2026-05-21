import { getFileTreeOpen, setFileTreeOpen } from '@TTH/state/accessors'

export const toggleFileTree = () => {
  setFileTreeOpen(!getFileTreeOpen())
}
