import type { TDef } from '@TSC/components/Definitions/Definition'

import { Definition } from '@TSC/components/Definitions/Definition'
import { DefsContainer } from '@TSC/components/Definitions/Definitions.styles'

export type TDefinitions<T extends TDef = TDef> = {
  definitions: T[]
  onDefinitionClick?: (definition: T) => void
}

export const Definitions = <T extends TDef = TDef>(props: TDefinitions<T>) => {
  const { definitions, onDefinitionClick } = props

  return (
    <DefsContainer className='tdsk-defs-container'>
      {definitions
        .filter((def) => !def.editor?.sidebar?.hidden)
        .map((def) => (
          <Definition
            key={def.id}
            definition={def}
            onClick={onDefinitionClick}
          />
        ))}
    </DefsContainer>
  )
}
