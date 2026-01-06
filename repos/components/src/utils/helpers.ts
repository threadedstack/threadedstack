export const stopEvent = (evt: any) => {
  if (!evt) return

  evt?.preventDefault?.()
  evt?.stopPropagation?.()
  if (`returnValue` in evt) evt.returnValue = false
  if (`cancelBubble` in evt) evt.cancelBubble = true
}

export const wrapEvtStop = (
  cb: (evt: any, ...args: any[]) => any,
  evt: any,
  ...args: any[]
) => {
  evt && stopEvent(evt)
  return cb(evt, ...args)
}
