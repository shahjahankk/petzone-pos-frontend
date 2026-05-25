import { formatDisplayDate } from './displayDates'
/**
 * buildPrintData.js
 *
 * Single source of truth: converts ANY sale object (from the API, Redux, or
 * the editable-invoice form) into the exact shape that PrintLayout expects.
 *
 * Usage
 * ─────
 * import buildPrintData from '@/utils/buildPrintData'
 *
 * const pd = buildPrintData({ sale, companyInfo, user, overrides })
 * // then pass pd directly to <PrintDialog printData={pd} />
 */

// ── helpers ──────────────────────────────────────────────────────────────────
function safeNum(v, fallback = 0) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

function resolveCustomerInfo(sale) {
  // customerInfo may be an object already or a JSON string
  if (sale.customerInfo && typeof sale.customerInfo === 'object') return sale.customerInfo
  if (sale.customer_info) {
    try {
      const ci = typeof sale.customer_info === 'string'
        ? JSON.parse(sale.customer_info)
        : sale.customer_info
      return ci || {}
    } catch (_) {}
  }
  return {}
}

function resolveCustomerName(sale, ci) {
  return (
    ci?.name ||
    sale.customerName ||
    sale.customer_name ||
    sale.retailerName ||
    sale.retailer_name ||
    'Walk-in Customer'
  )
}

function resolveCustomerPhone(sale, ci) {
  return (
    ci?.phone ||
    sale.customerPhone ||
    sale.customer_phone ||
    sale.retailerPhone ||
    sale.retailer_phone ||
    ''
  )
}

function resolvePaymentMethod(sale, ci) {
  return (
    sale.paymentMethod ||
    sale.payment_method ||
    ci?.paymentMethod ||
    ''
  )
}

function resolvePaymentType(sale, ci) {
  if (sale.paymentType || sale.payment_type) return sale.paymentType || sale.payment_type
  if (ci?.paymentType) return ci.paymentType

  const credit  = safeNum(sale.creditAmount  ?? sale.credit_amount  ?? 0)
  const payment = safeNum(sale.paymentAmount ?? sale.payment_amount ?? 0)

  if (credit > 0 && payment > 0) return 'PARTIAL_PAYMENT'
  if (credit > 0 && payment === 0) return 'FULLY_CREDIT'
  return 'FULL_PAYMENT'
}

/**
 * Normalise a single item row from any source.
 * Handles field names from the API, the cart in warehouse-billing,
 * and the editable-invoice form.
 */
function normaliseItem(item) {
  const name = item.itemName || item.name || item.item_name || 'Item'
  const sku  = item.sku  || ''
  const unit = item.unit || ''

  const qty = safeNum(item.quantity ?? item.qty ?? item.count, 0)

  // unit price: try every known alias
  let unitPrice = safeNum(
    item.customPrice  ??
    item.custom_price ??
    item.unitPrice    ??
    item.unit_price   ??
    item.price        ??
    item.sellingPrice ??
    item.selling_price, NaN
  )

  // item-level discount
  const discount = safeNum(item.discount ?? item.discountAmount ?? 0, 0)

  // line total
  let lineTotal = safeNum(
    item.total      ??
    item.total_price ??
    item.lineTotal   ??
    item.amount, NaN
  )

  // Derive missing values from each other
  if (!Number.isFinite(unitPrice) && Number.isFinite(lineTotal) && qty !== 0) {
    unitPrice = (lineTotal + discount) / qty
  }
  if (!Number.isFinite(lineTotal)) {
    lineTotal = Number.isFinite(unitPrice) ? unitPrice * qty - discount : 0
  }
  if (!Number.isFinite(unitPrice)) unitPrice = 0

  return {
    name,
    sku,
    unit,
    quantity : qty,
    unitPrice: Math.round(unitPrice),
    price    : Math.round(unitPrice),   // alias used by some layouts
    discount : Math.round(discount),
    total    : Math.round(lineTotal),
  }
}

// ── main export ───────────────────────────────────────────────────────────────
/**
 * @param {object} options
 * @param {object} options.sale        - Raw sale from API / Redux / form
 * @param {object} [options.companyInfo] - { name, address, phone, email, logoUrl }
 * @param {object} [options.user]      - Auth user  { name, username, role }
 * @param {string} [options.type]      - 'warehouse' | 'pos' | 'receipt'  (auto-detected if omitted)
 * @param {object} [options.overrides] - Any fields to force-override at the end
 * @param {object} [options.formData]  - Live form state from EditableInvoiceForm
 *                                       { items, customerName, customerPhone,
 *                                         paymentMethod, paymentStatus, notes, tax, hasTax }
 */
export default function buildPrintData({
  sale,
  companyInfo = {},
  user        = {},
  type,
  overrides   = {},
  formData    = null,  // when called from EditableInvoiceForm with live state
}) {
  if (!sale) return null

  const ci = resolveCustomerInfo(sale)

  // ── Scope / type detection ──
  const scopeType = sale.scope_type || sale.scopeType || ''
  const resolvedType = type || (scopeType === 'WAREHOUSE' ? 'warehouse' : 'pos')

  // ── Company / location ──
  const fallbackCompany = {
    name   : 'PetZone',
    address: '',
    phone  : '',
    email  : 'info@petzone.com',
    logoUrl: '/petzonelogo.png',
  }
  const co = { ...fallbackCompany, ...companyInfo }

  // Warehouse / branch name for the receipt header
const warehouseName = sale.warehouseName || sale.warehouse_name || (scopeType === 'WAREHOUSE' ? co.name : '') || ''
const branchName    = sale.branchName    || sale.branch_name    || (scopeType !== 'WAREHOUSE' ? co.name : '') || ''

  // ── Cashier / keeper name ──
  const cashierName =
    sale.cashierName ||
    sale.cashier_name ||
    sale.created_by  ||
    sale.username    ||
    sale.user_name   ||
    user?.name       ||
    user?.username   ||
    (resolvedType === 'warehouse' ? 'Warehouse Keeper' : 'Cashier')

  // ── Customer ──
  const customerName  = formData?.customerName  || resolveCustomerName(sale, ci)
  const customerPhone = formData?.customerPhone || resolveCustomerPhone(sale, ci)

  // ── Items ──
  // formData.items wins when the dialog is in live-edit mode
  const rawItems   = formData?.items || sale.items || []
  const items      = rawItems.map(normaliseItem)

  // ── Financials ──
  // When called from EditableInvoiceForm we re-compute from live state
  let subtotal, tax, discount, invoiceTotal

  if (formData) {
    subtotal     = Math.round(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0))
    discount     = Math.round(items.reduce((s, i) => s + i.discount, 0))
    tax          = formData.hasTax ? Math.round(safeNum(formData.tax, 0)) : 0
    invoiceTotal = Math.round(subtotal + tax - discount)
  } else {
    subtotal     = Math.round(safeNum(sale.subtotal,  0))
    tax          = Math.round(safeNum(sale.tax,        0))
    discount     = Math.round(safeNum(sale.discount    ?? sale.discountAmount ?? 0, 0))
    invoiceTotal = Math.round(safeNum(sale.invoiceTotal ?? sale.total, subtotal + tax - discount))
  }

  const useSnapshot = sale.financialSource === 'invoice_snapshots'
  if (useSnapshot && sale.snapshotTotal != null && Number.isFinite(parseFloat(sale.snapshotTotal))) {
    invoiceTotal = Math.round(safeNum(sale.snapshotTotal, invoiceTotal))
  }

  let oldBalance
  let paymentAmount
  let creditAmount
  let remainingBalance
  if (useSnapshot) {
    const ob = sale.oldBalance ?? sale.old_balance
    const rb = sale.runningBalance ?? sale.running_balance
    const pm = sale.paymentAmount ?? sale.snapshotPayment ?? sale.payment_amount
    oldBalance = ob != null && Number.isFinite(parseFloat(ob)) ? Math.round(parseFloat(ob)) : 0
    remainingBalance = rb != null && Number.isFinite(parseFloat(rb)) ? Math.round(parseFloat(rb)) : 0
    paymentAmount = pm != null && Number.isFinite(parseFloat(pm)) ? Math.round(parseFloat(pm)) : 0
    const cr = sale.creditAmount ?? sale.credit_amount
    creditAmount = cr != null && Number.isFinite(parseFloat(cr)) ? Math.round(parseFloat(cr)) : 0
  } else {
    oldBalance = Math.round(safeNum(sale.oldBalance ?? sale.old_balance ?? 0, 0))
    paymentAmount = Math.round(safeNum(sale.paymentAmount ?? sale.payment_amount ?? 0, 0))
    creditAmount = Math.round(safeNum(sale.creditAmount ?? sale.credit_amount ?? 0, 0))
    remainingBalance = Math.round(
      safeNum(sale.remainingBalance ?? sale.running_balance ?? sale.runningBalance ?? 0, 0)
    )
  }
  const change           = Math.round(safeNum(sale.change           ?? 0, 0))

  // ── Payment ──
  const paymentMethod = formData?.paymentMethod || resolvePaymentMethod(sale, ci)
  const paymentType   = resolvePaymentType(sale, ci)
  const paymentStatus = formData?.paymentStatus || sale.paymentStatus || sale.payment_status || ''

  // ── Dates ──
  const createdAt = formData?.saleDate || sale.sale_date || sale.saleDate || sale.created_at || sale.createdAt || new Date().toISOString()
  const dateObj   = new Date(createdAt.length === 10 ? `${createdAt}T12:00:00` : createdAt)
  const date      = formatDisplayDate(dateObj)
  const time      = dateObj.toLocaleTimeString()

  // ── Notes ──
  const notes = formData?.notes ?? sale.notes ?? ''

  // ── Assembled payload ──
  const result = {
    // meta
    type          : resolvedType,
    title         : resolvedType === 'warehouse' ? 'SALES RECEIPT' : 'SALES RECEIPT',

    // company / location  (PrintLayout picks warehouseName > branchName > companyName)
    companyName   : co.name,
    companyAddress: co.address,
    companyPhone  : co.phone,
    companyEmail  : co.email,
    logoUrl       : co.logoUrl,
    warehouseName,
    branchName,

    // invoice meta
    receiptNumber : sale.invoice_no || sale.invoiceNo || String(sale.id || ''),
    date,
    time,
    cashierName,

    // customer
    customerName,
    customerPhone,
    customerAddress: ci?.address || '',
    customerCity   : ci?.city    || '',

    // items
    items,

    // financials
    subtotal,
    tax,
    discount,
    invoiceTotal,
    oldBalance,
    paymentAmount,
    creditAmount,
    remainingBalance,
    change,

    // payment
    paymentMethod,
    paymentType,
    paymentStatus,

    // misc
    notes,
    footerMessage: 'Thank you for choosing PetZone!',
  }

  // Allow caller to force-override specific fields
  return { ...result, ...overrides }
}