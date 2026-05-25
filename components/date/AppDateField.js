'use client'

import AppDatePicker from './AppDatePicker'
import { parseDisplayDate, toIsoDateOnly } from '../../utils/displayDates'

export default function AppDateField({
  label,
  value,
  onChange,
  size = 'small',
  slotProps,
  ...pickerProps
}) {
  return (
    <AppDatePicker
      label={label}
      value={parseDisplayDate(value)}
      onChange={(newValue) => onChange?.(newValue ? toIsoDateOnly(newValue) : '')}
      slotProps={{
        textField: {
          fullWidth: true,
          size,
          InputLabelProps: { shrink: true },
          ...(slotProps?.textField || {}),
        },
        ...slotProps,
      }}
      {...pickerProps}
    />
  )
}
