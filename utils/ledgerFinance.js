/**
 * Helpers for ledger / invoice_snapshot financial payloads from the API.
 * When financialSource === 'invoice_snapshots', do not fall back to sales fields for money.
 */

export function isSnapshotFinancialPayload(obj) {
  return obj?.financialSource === 'invoice_snapshots'
}

/** @returns {number|null} */
export function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Running / closing balance for one ledger row (immutable read) or legacy sale row.
 * @returns {number|null} null only when truly unknown (avoid fake zeros for migrated snapshot gaps).
 */
export function pickTransactionBalance(transaction) {
  if (!transaction) return null
  const b = transaction.balance ?? transaction.running_balance ?? transaction.runningBalance
  const n = numOrNull(b)
  if (n !== null) return n
  // Do NOT return 0 as a fallback — 0.00 balance looks like "settled" to users
  // but is actually "unknown".  Callers will show '—' via formatMoneyOrDash.
  return null
}

export function pickTransactionOldBalance(transaction) {
  if (!transaction) return null
  const ob = transaction.old_balance ?? transaction.oldBalance
  return numOrNull(ob)
}

/**
 * Closing balance on GET /sales list rows after snapshot merge (null if no snapshot).
 * Same field precedence as {@link pickTransactionBalance}; sale rows omit ledger_entry_id.
 * @param {object} sale
 * @param {{ empty?: string }} [opts] empty string when unknown (CSV/Excel); use '—' for HTML if desired.
 * @returns {string}
 */
export function formatSaleBalanceForReport(sale, opts = {}) {
  const empty = opts.empty ?? ''
  const n = pickTransactionBalance(sale)
  if (n !== null && Number.isFinite(n)) return n.toFixed(2)
  return empty
}

/**
 * Format for UI: null/undefined → em dash (snapshot missing).
 */
export function formatMoneyOrDash(value, formatCurrency) {
  const n = numOrNull(value)
  if (n === null) return '—'
  return typeof formatCurrency === 'function' ? formatCurrency(n) : String(n)
}

/**
 * Normalise GET /sales/invoice/:id payload for components expecting snake_case + numbers.
 */
export function normalizeInvoiceDetailsData(data) {
  if (!data || typeof data !== 'object') return data
  const out = { ...data }
  if (isSnapshotFinancialPayload(out)) {
    out.old_balance = out.oldBalance
    out.running_balance = out.runningBalance
    out.payment_amount = out.paymentAmount
    out.credit_amount = out.creditAmount
    return out
  }
  out.oldBalance = numOrNull(out.oldBalance ?? out.old_balance) ?? 0
  out.runningBalance = numOrNull(out.runningBalance ?? out.running_balance) ?? 0
  out.old_balance = out.oldBalance
  out.running_balance = out.runningBalance
  return out
}
