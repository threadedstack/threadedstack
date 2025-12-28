
const isValidDate = (date:Date|number|string):date is Date => (
  Object.prototype.toString.call(date) === '[object Date]' && isFinite(date as number)
)

const ensureTwoDigits = (part:string|number) => {
  const check = `${part}`
  return check?.length > 1 ? check : `0${check}`
}

const getDateValues = (value:Date|string|number) => {
  
  
  const date = isValidDate(value) ? value : new Date(value)
  if(!isValidDate(date)) return {}
  
  const year = date.getUTCFullYear()
  const day = ensureTwoDigits(date.getUTCDate())

  // Months are 0 indexed for some reason?
  const month = ensureTwoDigits(date.getUTCMonth() + 1)
  const time = date.toLocaleTimeString()

  return {
    day,
    year,
    time,
    month,
  }
}

export const formatDateForInput = (value:Date|string|number) => {
  if(!value) return ``

  const { year, month, day } = getDateValues(value)

  return year && month && day
    ? `${year}-${month}-${day}`
    : ``
}

export const formatDateForDisplay = (value:Date|string|number, time?:boolean) => {
  if(!value) return ``

  const { year, month, day, time:tm } = getDateValues(value)
  
  return year && month && day
    ? time && tm
      ? `${month}/${day}/${year} ${tm}` 
      : `${month}/${day}/${year}`
    : ``
}