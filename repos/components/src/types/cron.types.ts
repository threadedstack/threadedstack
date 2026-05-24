export enum ERepeatType {
  minute = `minute`,
  hourly = `hourly`,
  daily = `daily`,
  weekly = `weekly`,
  monthly = `monthly`,
  yearly = `yearly`,
}

export enum EChangeType {
  end = `end`,
  time = `time`,
  days = `days`,
  cron = `cron`,
  start = `start`,
  repeat = `repeat`,
  interval = `interval`,
}
