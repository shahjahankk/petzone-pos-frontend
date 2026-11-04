'use client'

import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { MUI_DATE_FORMAT } from '../../utils/displayDates'

export default function AppDatePicker({ format = MUI_DATE_FORMAT, slots: _slots, ...props }) {
  return <DatePicker format={format} {...props} />
}
