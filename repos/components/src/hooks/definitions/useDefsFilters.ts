import type { TDef } from '@TSC/components/Definitions/Definition'


import { useMemo, useState } from 'react'
import { wait } from '@keg-hub/jsutils/wait'
import { flatUnion } from '@keg-hub/jsutils/flatUnion'


export type THDefsFilters = {
  search?:string
  groups?:string[]
  parentDef?:TDef
  definitions:TDef[]
}

export type TFilteredDefs = {
  defs:TDef[]
  groups:Record<string, TDef[]>
}


const convertToGroups = (definitions:TDef[]):Record<string, TDef[]> => {
  const groups = { [`default`]: [] }
  
  definitions.forEach((def) => {
    groups.default.push(def)

    def.groups.forEach(group => {
      if(group === `default`) return
      groups[group] = groups[group] || []
      !groups[group].includes(def) && groups[group].push(def)
    })

  })

  return groups
}



const findDefs = (search:string, definitions:TDef[]) => {

  const far:TDef[] = []
  const close:TDef[] = []
  const middle:TDef[] = []

  const parts = search.split(` `)
  search = search.toLowerCase().trim()

  definitions.forEach(def => {
    const groups = [
      def.name.toLowerCase(),
      def.type.toLowerCase(),
      ...(def?.owner || []).map(group => group.toLowerCase()),
      ...(def?.groups || []).map(group => group.toLowerCase()),
    ]

    groups.forEach(group => {
      if(group === search) close.push(def)
      else if(group.includes(search)) middle.push(def)
      else if(search.includes(group)) far.push(def)
    })

    def.description.includes(search) && far.push(def)
  })

  return flatUnion<TDef>(close, middle, far, (item:TDef) => item.id)
}


const getDefinitions = (props:THDefsFilters):TFilteredDefs => {
  const {
    search,
    parentDef,
    definitions
  } = props

  if(!parentDef?.owner?.length || parentDef.owner.includes(`default`)){
    const found = search ? findDefs(search, definitions) : definitions
    return {
      defs: found,
      groups: convertToGroups(found)
    }
  }

  const filtered = parentDef?.owner.map(owner => definitions.filter(def => def.id !== parentDef.id && def?.parents?.includes(owner)))
  const children = flatUnion(filtered, (def:TDef) => def.id)
  const found = search ? findDefs(search, children) : children

  return {
    defs: found,
    groups: convertToGroups(found)
  }

}

export const useDefsFilters = (props:THDefsFilters) => {
  
  const {
    parentDef,
    definitions
  } = props

  const [search, setSearch] = useState(``)
  const found = useMemo(() => getDefinitions({
    parentDef,
    definitions
  }), [parentDef, definitions])

  const [loading, setLoading] = useState(false)
  const [filtered, setFiltered] = useState<TFilteredDefs>(found)

  const onSearchChange = (evt:any) => {
    const text = evt.target.value
    setSearch(text)
    setFiltered(getDefinitions({
      parentDef,
      definitions,
      search:text,
    }))
  }
  
  const onSearchClick = async (evt:any) => {
    setLoading(true)
    setFiltered(getDefinitions({
      search,
      parentDef,
      definitions
    }))
    await wait(500)
    setLoading(false)
  }

  return {
    search,
    loading,
    onSearchClick,
    onSearchChange,
    groups: filtered.groups,
    definitions: filtered.defs,
  }

}