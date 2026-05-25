/**
 * Customer ledger display helpers (posting order unchanged — UI only).
 */

import { formatDisplayDate, formatDisplayDateTime } from './displayDates'

export function formatLedgerDate(iso) {
  return formatDisplayDate(iso)
}

export function formatLedgerDateTime(iso) {
  return formatDisplayDateTime(iso)
}

/** Business invoice date vs actual posting instant (different calendar day). */
export function isLedgerBackdated(row) {
  const inv = row?.invoiceDate
  const posted = row?.postedAt || row?.created_at
  if (!inv || !posted) return false
  const di = new Date(String(inv).length === 10 ? `${inv}T12:00:00` : inv)
  const dp = new Date(posted)
  if (Number.isNaN(di.getTime()) || Number.isNaN(dp.getTime())) return false
  return di.toDateString() !== dp.toDateString()
}

/**
 * Tooltip for the Invoice Date cell: explains posting time, and when relevant that
 * "(Backdated)" is invoice-day vs posting-day — independent of ledger Start/End filters.
 */
export function ledgerInvoiceDateCellTooltip(row) {
  const posted = row?.postedAt || row?.created_at
  const postedLine = posted ? `Posted on ${formatLedgerDateTime(posted)}.` : ''
  if (!isLedgerBackdated(row)) {
    return postedLine || 'Posting time for this row.'
  }
  const invLabel = formatLedgerDate(row?.invoiceDate || row?.transaction_date)
  return `${postedLine} Invoice business date (${invLabel}) is not the same calendar day as when this row was posted. This is not controlled by the Start/End date filters.`
}
