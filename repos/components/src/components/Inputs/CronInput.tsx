import type { TTextInput } from '@TSC/components/Inputs/TextInput'
import type { TSelectInput } from '@TSC/components/Inputs/SelectInput'
import type { TButtonGroup, TGroupButton } from '@TSC/components/Buttons/ButtonGroup'

import { cronToString } from '@TSC/utils/cron'
import { EChangeType, ERepeatType } from '@TSC/types'
import { useCron } from '@TSC/hooks/components/useCron'
import { TextInput } from '@TSC/components/Inputs/TextInput'
import { DaysOfWeek, RepeatOpts } from '@TSC/constants/elements'
import { SelectInput } from '@TSC/components/Inputs/SelectInput'

import {
  DayButton,
  CronInputsRow,
  CronContainer,
  DayButtonGroup,
} from '@TSC/components/Inputs/CronInput.styles'

export type TCronChange = {
  time: string
  end?: string
  start: string
  value: string
  days: string[]
  interval: number
  repeat: ERepeatType
}

export type TCronInput = {
  value: string
  disabled?: boolean
  showCron?: boolean
  endProps?: Partial<TTextInput>
  timeProps?: Partial<TTextInput>
  startProps?: Partial<TTextInput>
  dayProps?: Partial<TGroupButton>
  daysProps?: Partial<TButtonGroup>
  intervalProps?: Partial<TTextInput>
  repeatProps?: Partial<TSelectInput>
  onChange?: (e: any, change: TCronChange) => any
}

export const CronInput = (props: TCronInput) => {
  const {
    disabled,
    showCron,
    endProps,
    dayProps,
    daysProps,
    timeProps,
    startProps,
    repeatProps,
    intervalProps,
  } = props

  const { days, time, repeat, endDate, interval, startDate, onChangeVal } = useCron(props)

  return (
    <CronContainer>
      <CronInputsRow className='cron-inputs-interval'>
        <TextInput
          required
          id='interval'
          label='Every'
          type='number'
          disabled={disabled}
          value={interval as any}
          {...intervalProps}
          onChange={(e) => onChangeVal(e, Number(e.target.value), EChangeType.interval)}
        />
        <SelectInput
          required
          id='repeat'
          label='Repeat'
          value={repeat}
          items={RepeatOpts}
          disabled={disabled}
          {...repeatProps}
          onChange={(e) => onChangeVal(e, e.target.value as string, EChangeType.repeat)}
        />
      </CronInputsRow>

      {repeat === 'weekly' && (
        <CronInputsRow className='cron-inputs-days'>
          <DayButtonGroup
            value={days}
            {...daysProps}
            onChange={(e: any, days: string[]) => onChangeVal(e, days, EChangeType.days)}
          >
            {DaysOfWeek.map((day) => (
              <DayButton
                key={day}
                value={day}
                disabled={disabled}
                {...dayProps}
              >
                {day}
              </DayButton>
            ))}
          </DayButtonGroup>
        </CronInputsRow>
      )}

      <CronInputsRow className='cron-inputs-timing'>
        <TextInput
          required
          id='time'
          type='time'
          label='Time'
          value={time}
          disabled={disabled}
          {...timeProps}
          onChange={(e) => onChangeVal(e, e.target.value, EChangeType.time)}
        />

        <TextInput
          required
          type='date'
          id='start-date'
          value={startDate}
          label='Start Date'
          disabled={disabled}
          {...startProps}
          onChange={(e) => onChangeVal(e, e.target.value, EChangeType.start)}
        />

        <TextInput
          type='date'
          id='end-date'
          value={endDate}
          label='End Date'
          disabled={disabled}
          {...endProps}
          onChange={(e) => onChangeVal(e, e.target.value, EChangeType.end)}
        />
      </CronInputsRow>

      {showCron && (
        <TextInput
          disabled
          id='cron-expression'
          label='Cron Expression'
          value={cronToString({ days, time, repeat, interval })}
        />
      )}
    </CronContainer>
  )
}
