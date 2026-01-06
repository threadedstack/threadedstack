import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useState } from 'react'

type THToggleResp = [boolean, () => void, Dispatch<SetStateAction<boolean>>]

export const useToggle = (def?: boolean): THToggleResp => {
  const [value, setValue] = useState(!!def)
  const toggle = useCallback(() => setValue((x) => !x), [])

  return [value, toggle, setValue]
}
