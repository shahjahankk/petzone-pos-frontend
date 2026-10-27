// Reads the wall-clock digits straight from the stored string, ignoring any
// "Z"/offset, so no timezone conversion can happen.
const WALL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/

const parts = (v) => {
  if (!v) return null
  if (typeof v === 'string') {
    const m = v.match(WALL)
    if (m) return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] || 0) }
  }
  const dt = new Date(v)
  if (isNaN(dt)) return null
  return { y: dt.getFullYear(), mo: dt.getMonth() + 1, d: dt.getDate(), h: dt.getHours(), mi: dt.getMinutes(), s: dt.getSeconds() }
}

// Local Date object carrying the stored wall-clock values (safe for formatDisplayDate)
export const saleDate = (v) => {
  const p = parts(v)
  return p ? new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) : null
}

// "05:24 PM"
export const formatSaleTime = (v) => {
  const p = parts(v)
  if (!p) return 'N/A'
  return `${String(p.h % 12 || 12).padStart(2, '0')}:${String(p.mi).padStart(2, '0')} ${p.h >= 12 ? 'PM' : 'AM'}`
}

// Local "YYYY-MM-DD" from a Date (replaces toISOString().split('T')[0])
export const toYMD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`