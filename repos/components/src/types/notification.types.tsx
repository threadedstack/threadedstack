export type NotificationCountProps = {
  count?: number | string
  inputProps?: {
    id: string
    max?: number
    min?: number
    step?: number
    onChange?: (event: any) => void
    onMouseUp?: (event: any) => void
    onMouseDown?: (event: any) => void
  }
}
