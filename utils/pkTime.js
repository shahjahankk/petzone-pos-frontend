const PK_OFFSET_MS = 5 * 60 * 60 * 1000

export const getPkTime = (source = new Date()) => {
  const shifted = new Date(source.getTime() + PK_OFFSET_MS)
  const hour = shifted.getUTCHours()
  const minute = shifted.getUTCMinutes()

  return {
    dateKey: shifted.toISOString().slice(0, 10),
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  }
}

export const toPkDateKey = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return getPkTime(date).dateKey
}
