import type { MutableRefObject, ReactNode, ComponentProps } from 'react'

import { Fragment, useEffect } from 'react'
import { cls } from '@keg-hub/jsutils/cls'

import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  getPanelElement,
  getPanelGroupElement,
  getResizeHandleElement,
} from 'react-resizable-panels'


type TResizePanelRef = {
  panel?:HTMLElement
  handle?:HTMLElement
}

export type TResizeRef = {
  group?:HTMLElement
  panels?:Record<string, TResizePanelRef>
}

export type TResizePanel = ComponentProps<typeof Panel> & {
  //id?: string;
  //order?: number;
  //style?: object;
  //className?: string;
  //onExpand?: PanelOnExpand;
  //onResize?: PanelOnResize;
  //maxSize?: number | undefined;
  //minSize?: number | undefined;
  //onCollapse?: PanelOnCollapse;
  //collapsedSize?: number | undefined;
  //collapsible?: boolean | undefined;
  //defaultSize?: number | undefined;
  //tagName?: keyof HTMLElementTagNameMap | undefined;
  handle?:boolean
  key?:string|number
  component:ReactNode
}

export type TResize = ComponentProps<typeof PanelGroup> & {
  panels:TResizePanel[]
  panelRef?:MutableRefObject<any>
  resizeRef?:MutableRefObject<TResizeRef>
}

export const Resize = (props:TResize) => {

  const {
    id,
    dir,
    style,
    panels,
    tagName,
    storage,
    panelRef,
    onLayout,
    className,
    resizeRef,
    autoSaveId,
    keyboardResizeBy,
    direction=`horizontal`
  } = props
  
  useEffect(() => {
    if(!resizeRef) return

    resizeRef.current = {
      group: id && getPanelGroupElement(id),
      panels: panels.reduce((acc, panel) => {
        if(!panel?.id || !panel?.component) return acc

        acc[panel.id] = {
          panel: getPanelElement(panel.id),
          handle: panel?.handle ? getResizeHandleElement(`${panel.id}-resize-handle`) : undefined
        }
        return acc
      }, {})
    }
  }, [])
  
  return (
    <PanelGroup
      id={id}
      dir={dir}
      style={style}
      ref={panelRef}
      tagName={tagName}
      storage={storage}
      onLayout={onLayout}
      direction={direction}
      autoSaveId={autoSaveId}
      keyboardResizeBy={keyboardResizeBy}
      className={cls(`tdsk-resize-group`, className)}
    >
    
    {panels?.map(panel => {
      if(!panel?.component) return null
      
      const {
        id,
        handle,
        component,
        defaultSize=0,
        ...rest
      } = panel

      return (
        <Fragment key={rest?.key || id} >
          <Panel
            id={id}
            {...rest}
            defaultSize={defaultSize}
          >
            {component}
          </Panel>
          {handle && (<PanelResizeHandle id={id ? `${id}-resize-handle` : undefined} />)}
        </Fragment>
      )
    })}

    </PanelGroup>
  )
  
}