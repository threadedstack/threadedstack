import type { ComponentProps } from 'react'
import type { TDef } from '@TSC/components/Definitions/Definition'

import LibraryBooksIcon from '@mui/icons-material/LibraryBooks'
import { Definitions } from '@TSC/components/Definitions/Definitions'
import { DefsFilters } from '@TSC/components/Definitions/DefsFilters'
import { useDefsFilters } from '@TSC/hooks/definitions/useDefsFilters'
import {
  CDAccordion,
  DefGroupBox,
  DefGroupHeader,
  DefGroupTitle,
} from '@TSC/components/Definitions/ComplexDefs.styles'

export type TComplexDefs = ComponentProps<typeof Definitions> &
  ComponentProps<typeof CDAccordion> & {
    parentDef?: TDef
  }

export const ComplexDefs = (props: TComplexDefs) => {
  const {
    id,
    panel,
    parentDef,
    expanded,
    onChange,
    className,
    definitions,
    showHeader = true,
    openBottomBorder,
    onDefinitionClick,
    title = `Definitions`,
    Icon = <LibraryBooksIcon />,
  } = props

  const {
    groups,
    search,
    loading,
    onSearchClick,
    onSearchChange,
    definitions: defs,
  } = useDefsFilters({ parentDef, definitions })

  const groupsArr = Object.entries(groups)

  return (
    <CDAccordion
      id={id}
      Icon={Icon}
      panel={panel}
      title={title}
      onChange={onChange}
      expanded={expanded}
      className={className}
      showHeader={showHeader}
      openBottomBorder={openBottomBorder}
    >
      <DefsFilters
        search={search}
        loading={loading}
        onSearchClick={onSearchClick}
        onSearchChange={onSearchChange}
      />
      {groupsArr?.length > 1 ? (
        groupsArr.map(([group, gdef]) => {
          if (group === `default`) return null

          return (
            <DefGroupBox
              key={group}
              className='tdsk-def-group-box'
            >
              <DefGroupHeader>
                <DefGroupTitle>{group}</DefGroupTitle>
              </DefGroupHeader>
              <Definitions
                definitions={gdef}
                onDefinitionClick={onDefinitionClick}
              />
            </DefGroupBox>
          )
        })
      ) : (
        <DefGroupBox className='tdsk-def-group-box'>
          <Definitions
            definitions={defs}
            onDefinitionClick={onDefinitionClick}
          />
        </DefGroupBox>
      )}
    </CDAccordion>
  )
}
