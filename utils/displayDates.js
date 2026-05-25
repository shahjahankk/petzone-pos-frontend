/** App-wide date display — month names (e.g. 14 May 2026, not 14/05/2026). */

export const DISPLAY_DATE_LOCALE = 'en-GB'

export const DISPLAY_DATE_OPTIONS = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

export const DISPLAY_DATETIME_OPTIONS = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
}

export const MUI_DATE_FORMAT = 'dd MMM yyyy'
export const DATE_FNS_DISPLAY_FORMAT = 'dd MMM yyyy'

export function parseDisplayDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const s = String(value).trim()
  if (!s || s === 'null' || s === 'undefined') return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.length === 10 ? `${s}T12:00:00` : s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function toIsoDateOnly(value) {
  const d = parseDisplayDate(value)
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDisplayDate(value, fallback = 'N/A') {
  const d = parseDisplayDate(value)
  if (!d) return fallback
  return d.toLocaleDateString(DISPLAY_DATE_LOCALE, DISPLAY_DATE_OPTIONS)
}

export function formatDisplayDateTime(value, fallback = 'N/A') {
  const d = parseDisplayDate(value)
  if (!d) return fallback
  return d.toLocaleString(DISPLAY_DATE_LOCALE, DISPLAY_DATETIME_OPTIONS)
}

export function formatDisplayMonthYear(year, month) {
  const y = Number(year)
  const m = Number(month)
  if (!y || !m) return 'N/A'
  const d = new Date(y, m - 1, 1)
  if (Number.isNaN(d.getTime())) return 'N/A'
  return d.toLocaleDateString(DISPLAY_DATE_LOCALE, { month: 'long', year: 'numeric' })
}
