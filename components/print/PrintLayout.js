'use client'
/* eslint-disable @next/next/no-img-element */

import React from 'react'
import './PrintLayout.css'
import { getPrintLogoSizes } from '../../utils/brandAssets'

function safeNumber(v) {
  return v == null || isNaN(Number(v)) ? 0 : Number(v)
}

function formatCurrency(v) {
  const n = safeNumber(v)
  try {
    const rounded = Math.round(n)
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rounded)
  } catch (e) {
    return String(Math.round(n))
  }
}

// ── Small helper components ────────────────────────────────────────────────────
function Row({ label, value, bold, large, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      marginBottom: '5px',
      fontSize: large ? '14px' : '12px',
      color: color || '#000',
      fontWeight: bold ? 'bold' : 'normal'
    }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function ThermalRow({ label, value, bold, large, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      marginBottom: '3px',
      fontSize: large ? '14px' : '11px',
      fontWeight: bold ? 800 : 700,
      color: color || '#000'
    }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function SigBox({ label }) {
  return (
    <div style={{ width: '48%', borderTop: '1px solid #000', paddingTop: '8px' }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{label}:</div>
      <div style={{ fontSize: '11px', color: '#888', minHeight: '48px' }}>________________________________</div>
    </div>
  )
}


export default function PrintLayout({
  type = 'receipt',
  title = 'RECEIPT',
  companyName = 'Petzone Store',
  companySlogan = '',
  companyAddress = '',
  companyPhone = '',
  companyEmail = '',
  logoUrl = '/petzonelogo.png',
  receiptNumber,
  date,
  time,
  cashierName,
  branchName = '',
  warehouseName = '',
  customerName = 'Walk-in Customer',
  customerPhone = '',
  customerAddress = '',
  customerCity = '',
  items = [],
  subtotal = 0,
  tax = 0,
  total = 0,
  paymentMethod = 'Cash',
  paymentAmount = 0,
  creditAmount = 0,
  remainingBalance = null,
  oldBalance = 0,
  discount = 0,
  change = 0,
  shippingHandling = 0,
  notes = '',
  footerMessage = 'Thank you for choosing us!',
  showLogo = true,
  layout = 'thermal',
  invoiceTotal = null,
  showSignature = false,
  // New: pass isItemSheet=true to render a price-hidden item/packing sheet
  isItemSheet = false,
}) {

  const [logoError, setLogoError] = React.useState(false)

  const effectiveLogoUrl = React.useMemo(() => {
    if (!logoUrl) return '/petzonelogo.png'
    if (typeof logoUrl === 'string' &&
      (logoUrl.startsWith('http://') || logoUrl.startsWith('https://') || logoUrl.startsWith('data:')))
      return logoUrl
    return logoUrl
  }, [logoUrl])

  const logoSizes = React.useMemo(() => getPrintLogoSizes(effectiveLogoUrl), [effectiveLogoUrl])

  React.useEffect(() => setLogoError(false), [effectiveLogoUrl])

  // ── Computed numbers ──
  const nSubtotal  = safeNumber(subtotal)
  const nTax       = safeNumber(tax)
  const nDiscount  = safeNumber(discount)
  const nOld       = safeNumber(oldBalance)
  const nPayment   = safeNumber(paymentAmount)
  const nCredit    = safeNumber(creditAmount)
  const nShipping  = safeNumber(shippingHandling)

  const computedInvoiceTotal = invoiceTotal != null
    ? safeNumber(invoiceTotal)
    : (nSubtotal + nTax - nDiscount)

  const displayedTotal = computedInvoiceTotal + nOld

  const computedRemaining = remainingBalance != null
    ? safeNumber(remainingBalance)
    : Math.max(0, (nOld + computedInvoiceTotal) - nPayment)

  const shouldShowRemaining = computedRemaining > 0 || nOld !== 0

  // Location = warehouse name > branch name > company name
  const locationName = warehouseName || branchName || companyName || 'PetZone'

  // ─────────────────────────────────────────────────────────────────────────────
  // COLOR / INVOICE LAYOUT
  // ─────────────────────────────────────────────────────────────────────────────
  if (layout === 'color') {
    const finalTotal = computedInvoiceTotal + nOld + nShipping

    return (
      <div
        className="receipt-container color-layout"
        style={{
          width: '100%',
          maxWidth: '1350px',
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          lineHeight: '1.3',
          color: '#000',
          backgroundColor: '#fff',
          padding: '16px 24px',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* ══ HEADER: Left = logo + company info | Right = invoice meta ══ */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: '18px', gap: '24px'
        }}>

          {/* LEFT: logo → company info → "To:" block */}
          <div style={{ flex: 1 }}>
            {/* Logo */}
            {showLogo && (
              <div style={{ marginBottom: '8px' }}>
                {!logoError ? (
                  <img
                    src={effectiveLogoUrl}
                    alt={locationName}
                    style={{
                      maxHeight: logoSizes.colorMaxHeight,
                      maxWidth: logoSizes.colorMaxWidth,
                      objectFit: 'contain',
                      display: 'block',
                    }}
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div style={{ fontWeight: 'bold', fontSize: '22px' }}>{locationName}</div>
                )}
              </div>
            )}

            {/* Branch / Warehouse name */}
            <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>{locationName}</div>
            {companyPhone   && <div style={{ fontSize: '12px', marginBottom: '2px' }}>Tel: {companyPhone}</div>}
            {companyAddress && <div style={{ fontSize: '12px', marginBottom: '2px', lineHeight: '1.4' }}>{companyAddress}</div>}
            {companyEmail   && <div style={{ fontSize: '12px', marginBottom: '2px' }}>{companyEmail}</div>}

            {/* Bill-To block */}
            <div style={{ marginTop: '14px' }}>
              <div style={{
                fontWeight: 'bold', fontSize: '10px', color: '#555',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'
              }}>
                To:
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>
                {customerName || 'Walk-in Customer'}
              </div>
              {customerPhone   && <div style={{ fontSize: '12px', marginBottom: '2px' }}>Tel: {customerPhone}</div>}
              {customerAddress && <div style={{ fontSize: '12px', marginBottom: '2px' }}>{customerAddress}</div>}
              {customerCity    && <div style={{ fontSize: '12px', marginBottom: '2px' }}>{customerCity}</div>}
            </div>
          </div>

          {/* RIGHT: invoice heading + meta */}
          <div style={{ textAlign: 'right', flex: '0 0 auto', minWidth: '220px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '22px', marginBottom: '6px' }}>
              {isItemSheet
                ? 'ITEM SHEET'
                : type === 'warehouse' ? 'WAREHOUSE INVOICE' : 'INVOICE'}
            </div>
            <div style={{ fontSize: '12px', marginBottom: '3px' }}>
              <strong>{isItemSheet ? 'Sheet #' : 'Invoice #'}:</strong> {receiptNumber || '—'}
            </div>
            {cashierName && (
              <div style={{ fontSize: '12px', marginBottom: '3px' }}>
                <strong>{type === 'warehouse' ? 'Warehouse Keeper:' : 'Cashier:'}</strong> {cashierName}
              </div>
            )}
            <div style={{ fontSize: '12px', marginBottom: '3px' }}>
              <strong>Date:</strong> {date || '—'}
            </div>
            {time && (
              <div style={{ fontSize: '11px', color: '#555' }}>
                <strong>Time:</strong> {time}
              </div>
            )}
          </div>
        </div>

        {/* ══ ITEMS TABLE ══ */}
        <div style={{ marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ border: '1px solid #ccc', padding: '5px 10px', textAlign: 'left', fontWeight: 'bold', width: isItemSheet ? '70%' : '46%' }}>
                  DESCRIPTION
                </th>
                <th style={{ border: '1px solid #ccc', padding: '5px 10px', textAlign: 'center', fontWeight: 'bold', width: isItemSheet ? '15%' : '14%' }}>
                  QTY
                </th>
                {isItemSheet ? (
                  <th style={{ border: '1px solid #ccc', padding: '5px 10px', textAlign: 'left', fontWeight: 'bold', width: '15%' }}>
                    UNIT
                  </th>
                ) : (
                  <>
                    <th style={{ border: '1px solid #ccc', padding: '5px 10px', textAlign: 'right', fontWeight: 'bold', width: '20%' }}>UNIT PRICE</th>
                    <th style={{ border: '1px solid #ccc', padding: '5px 10px', textAlign: 'right', fontWeight: 'bold', width: '20%' }}>TOTAL</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {items && items.length
                ? items.map((item, index) => {
                    const qty = Number.isFinite(item.quantity) ? item.quantity : 0
                    let unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice :
                      (Number.isFinite(item.price) ? item.price : 0)
                    let lineTotal = Number.isFinite(item.total) ? item.total :
                      (Number.isFinite(item.total_price) ? item.total_price : 0)
                    if ((!unitPrice) && qty && lineTotal) unitPrice = (lineTotal + safeNumber(item.discount || 0)) / qty
                    if ((!lineTotal) && unitPrice && qty) lineTotal = unitPrice * qty - safeNumber(item.discount || 0)

                    return (
                      <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                        <td style={{ border: '1px solid #ccc', padding: '4px 10px' }}>
                          <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                          {item.sku && <div style={{ fontSize: '10px', color: '#777' }}>SKU: {item.sku}</div>}
                          {!isItemSheet && item.discount > 0 && (
                            <div style={{ fontSize: '11px', color: '#d32f2f' }}>
                              Discount: -{formatCurrency(item.discount)}
                            </div>
                          )}
                        </td>
                        <td style={{ border: '1px solid #ccc', padding: '4px 10px', textAlign: 'center' }}>
                          {formatCurrency(qty)}
                        </td>
                        {isItemSheet ? (
                          <td style={{ border: '1px solid #ccc', padding: '4px 10px', textAlign: 'left' }}>
                            {item.unit || ''}
                          </td>
                        ) : (
                          <>
                            <td style={{ border: '1px solid #ccc', padding: '4px 10px', textAlign: 'right' }}>
                              {formatCurrency(unitPrice)}
                            </td>
                            <td style={{ border: '1px solid #ccc', padding: '4px 10px', textAlign: 'right', fontWeight: 'bold' }}>
                              {formatCurrency(lineTotal)}
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })
                : (
                  <tr>
                    <td colSpan={isItemSheet ? 3 : 4} style={{ border: '1px solid #ddd', padding: '20px', textAlign: 'center', color: '#999' }}>
                      No items
                    </td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>

        {/* ══ TOTALS — hidden for item sheet ══ */}
        {!isItemSheet && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
            <div style={{ width: '55%', minWidth: '320px' }}>
              <Row label="SUBTOTAL"   value={formatCurrency(nSubtotal)} bold />
              {(() => {
                const itemDiscSum = (items || []).reduce((s, it) => s + safeNumber(it.discount), 0)
                return itemDiscSum > 0
                  ? <Row label="ITEM DISC" value={`-${formatCurrency(itemDiscSum)}`} bold color="#d32f2f" />
                  : null
              })()}
              {nDiscount > 0 && (
                <Row label="DISCOUNT" value={`-${formatCurrency(nDiscount)}`} bold color="#d32f2f" />
              )}
              <Row label="SALES TAX"  value={formatCurrency(nTax)} bold />
              {nShipping > 0 && (
                <Row label="SHIPPING & HANDLING" value={formatCurrency(nShipping)} bold />
              )}
              {nOld !== 0 && (
                <Row label="OLD BALANCE" value={formatCurrency(nOld)} bold />
              )}

              <div style={{ borderTop: '2px solid #000', margin: '10px 0', paddingTop: '10px' }}>
                <Row label="TOTAL DUE" value={formatCurrency(finalTotal)} bold large />
              </div>

              {/* Payment details */}
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #000' }}>
                <Row label="Payment Method" value={paymentMethod} />
                <Row label="Payment Amount" value={formatCurrency(nPayment)} />
                {(nCredit > 0 || paymentMethod === 'FULLY_CREDIT') && (
                  <Row label="Credit Amount" value={formatCurrency(nCredit || finalTotal)} />
                )}
                {shouldShowRemaining && (
                  <Row label="Remaining Balance" value={formatCurrency(computedRemaining)} bold />
                )}
                {change > 0 && (
                  <Row label="Change" value={formatCurrency(change)} bold color="green" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div style={{
            marginBottom: '12px', padding: '8px 12px',
            backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '12px'
          }}>
            <strong>Notes:</strong> {notes}
          </div>
        )}

        {/* Signatures */}
        {(showSignature || type === 'warehouse') && !isItemSheet && (
          <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
            <SigBox label={type === 'warehouse' ? 'Received By' : 'Customer Signature'} />
            <SigBox label={type === 'warehouse' ? 'Signature'   : 'Authorized Signature'} />
          </div>
        )}
        {isItemSheet && (
          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
            <SigBox label="Received By" />
            <SigBox label="Checked By"  />
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '12px', borderTop: '2px solid #000' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px' }}>{footerMessage}</div>
          <div style={{ fontSize: '10px', color: '#666' }}>Powered by Tychora | www.tychora.com</div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // THERMAL LAYOUT  (also handles isItemSheet for thermal item sheets)
  // ─────────────────────────────────────────────────────────────────────────────
  const LINE      = <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
  const BOLD_LINE = <div style={{ borderTop: '2px solid #000', margin: '4px 0' }} />
  const EQ_LINE   = <div style={{ borderTop: '2px solid #000', margin: '4px 0' }} />

  return (
    <div
      className="receipt-container thermal-layout"
      style={{
        width: '100%',
        maxWidth: '100%',
        fontFamily: 'monospace',
        fontSize: '11px',
        lineHeight: '1.15',
        color: '#000',
        backgroundColor: '#fff',
        padding: '4px 2px',
        margin: '0',
        boxSizing: 'border-box',
      }}
    >
      {/* ══ HEADER ══ */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        {showLogo && (
          <div style={{ marginBottom: '4px' }}>
            {!logoError ? (
              <img
                src={effectiveLogoUrl}
                alt={locationName}
                style={{
                  maxHeight: logoSizes.thermalMaxHeight,
                  maxWidth: '100%',
                  width: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto',
                }}
                onError={() => setLogoError(true)}
              />
            ) : (
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{locationName}</div>
            )}
          </div>
        )}
        <div style={{ fontWeight: '900', fontSize: '16px', marginBottom: '2px', letterSpacing: '0.2px', wordBreak: 'break-word', lineHeight: 1.2 }}>{locationName}</div>
        {companyPhone   && <div style={{ fontSize: '10px', marginBottom: '1px' }}>Tel: {companyPhone}</div>}
        {companyAddress && <div style={{ fontSize: '9px',  marginBottom: '1px', lineHeight: '1.3', wordBreak: 'break-word' }}>{companyAddress}</div>}
        {companyEmail   && <div style={{ fontSize: '9px',  marginBottom: '1px' }}>{companyEmail}</div>}
      </div>

      {LINE}
      <div style={{ fontWeight: '900', textAlign: 'center', fontSize: '12px', textTransform: 'uppercase', margin: '2px 0', letterSpacing: '0.8px' }}>
        {isItemSheet ? 'ITEM SHEET' : (title || 'SALES RECEIPT')}
      </div>
      {LINE}

      {/* ══ META ══ */}
      <ThermalRow label={isItemSheet ? 'Sheet #' : 'Receipt #'} value={receiptNumber || '—'} />
      <ThermalRow label="Date"     value={date || '—'} />
      {time && <ThermalRow label="Time" value={time} />}
      <ThermalRow label={type === 'warehouse' ? 'W.Keeper' : 'Cashier'} value={cashierName || '—'} />
      <ThermalRow label="Customer" value={customerName || 'Walk-in'} />
      {customerPhone && <ThermalRow label="Phone" value={customerPhone} />}

      {BOLD_LINE}

      {/* ══ ITEMS HEADER ══ */}
      {isItemSheet ? (
        <div style={{ display: 'flex', fontWeight: 900, fontSize: '11px', marginBottom: '3px', borderBottom: '1px dashed #000', paddingBottom: '3px' }}>
          <div style={{ flex: 3 }}>ITEM</div>
          <div style={{ width: '40px', textAlign: 'right' }}>QTY</div>
          <div style={{ width: '50px', textAlign: 'right' }}>UNIT</div>
        </div>
      ) : (
        <div style={{ display: 'flex', fontWeight: 900, fontSize: '11px', marginBottom: '3px', borderBottom: '1px dashed #000', paddingBottom: '3px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>ITEM</div>
          <div style={{ width: '32px', textAlign: 'right', flexShrink: 0 }}>QTY</div>
          <div style={{ width: '52px', textAlign: 'right', flexShrink: 0 }}>PRICE</div>
          <div style={{ width: '52px', textAlign: 'right', flexShrink: 0 }}>TOTAL</div>
        </div>
      )}

      {/* ══ ITEMS ══ */}
      {items && items.length
        ? items.map((item, index) => {
            const qty = Number.isFinite(item.quantity) ? item.quantity : 0
            let unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice :
              (Number.isFinite(item.price) ? item.price : 0)
            let lineTotal = Number.isFinite(item.total) ? item.total :
              (Number.isFinite(item.total_price) ? item.total_price : 0)
            if (!unitPrice && qty && lineTotal) unitPrice = (lineTotal + safeNumber(item.discount || 0)) / qty
            if (!lineTotal && unitPrice && qty)  lineTotal = unitPrice * qty - safeNumber(item.discount || 0)

            return (
              <div key={index} style={{ marginBottom: '5px', paddingBottom: '3px', borderBottom: '1px dotted #bbb' }}>
                <div style={{ fontWeight: 800, fontSize: '11px' }}>{item.name}</div>
                {isItemSheet ? (
                  <div style={{ display: 'flex', fontSize: '11px' }}>
                    <div style={{ flex: 3 }}></div>
                    <div style={{ width: '40px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(qty)}</div>
                    <div style={{ width: '50px', textAlign: 'right' }}>{item.unit || ''}</div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', fontSize: '11px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}></div>
                      <div style={{ width: '32px', textAlign: 'right', flexShrink: 0, fontWeight: 700 }}>{formatCurrency(qty)}</div>
                      <div style={{ width: '52px', textAlign: 'right', flexShrink: 0, fontWeight: 700 }}>{formatCurrency(unitPrice)}</div>
                      <div style={{ width: '52px', textAlign: 'right', flexShrink: 0, fontWeight: 900 }}>{formatCurrency(lineTotal)}</div>
                    </div>
                    {item.discount > 0 && (
                      <div style={{ fontSize: '10px', color: '#d32f2f', textAlign: 'right', fontWeight: 700 }}>
                        Disc: -{formatCurrency(item.discount)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })
        : (
          <div style={{ textAlign: 'center', fontSize: '10px', color: '#999', padding: '8px 0' }}>No items</div>
        )
      }

      {/* ══ TOTALS — hidden for item sheet ══ */}
      {!isItemSheet && (
        <>
          {EQ_LINE}
          <ThermalRow label="Subtotal" value={formatCurrency(nSubtotal)} bold />
          {nTax > 0 && <ThermalRow label="Tax" value={formatCurrency(nTax)} bold />}
          {(() => {
            const itemDiscSum = (items || []).reduce((s, it) => s + safeNumber(it.discount), 0)
            return itemDiscSum > 0
              ? <ThermalRow label="Item Disc" value={`-${formatCurrency(itemDiscSum)}`} color="#d32f2f" bold />
              : null
          })()}
          {nDiscount > 0 && <ThermalRow label="Discount" value={`-${formatCurrency(nDiscount)}`} color="#d32f2f" bold />}
          {LINE}
          <ThermalRow label="Invoice" value={formatCurrency(computedInvoiceTotal)} bold />
          {nOld !== 0 && <ThermalRow label="Old Balance" value={formatCurrency(nOld)} bold />}
          <div style={{
            border: '2px solid #000', margin: '6px 0', padding: '6px 4px', textAlign: 'center'
          }}>
            <div style={{ fontWeight: 900, fontSize: '15px', letterSpacing: '0.5px' }}>
              TOTAL  {formatCurrency(displayedTotal)}
            </div>
          </div>

          <div style={{ marginTop: '2px', borderTop: '1px dashed #000', paddingTop: '4px' }}>
            <div style={{ fontWeight: 900, fontSize: '11px', marginBottom: '3px' }}>PAYMENT</div>
            <ThermalRow label="Method" value={paymentMethod} bold />
            <ThermalRow label="Paid" value={formatCurrency(nPayment)} bold />
            {(nCredit > 0 || paymentMethod === 'FULLY_CREDIT') && (
              <ThermalRow label="Credit" value={formatCurrency(nCredit || displayedTotal)} bold />
            )}
            {shouldShowRemaining && (
              <ThermalRow label="Remaining" value={formatCurrency(computedRemaining)} bold />
            )}
            {change > 0 && (
              <ThermalRow label="Change" value={formatCurrency(change)} bold />
            )}
          </div>
        </>
      )}

      {/* Notes */}
      {notes && (
        <>
          {LINE}
          <div style={{ fontSize: '9px' }}><strong>Notes:</strong> {notes}</div>
        </>
      )}

      {/* Item sheet signatures */}
      {isItemSheet && (
        <>
          {LINE}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
            <div style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '4px' }}>Received By</div>
            <div style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '4px' }}>Checked By</div>
          </div>
        </>
      )}

      {/* Footer */}
      {BOLD_LINE}
      <div style={{ textAlign: 'center', marginTop: '4px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, marginBottom: '2px' }}>{footerMessage}</div>
        <div style={{ fontSize: '10px', marginBottom: '3px' }}>Return within 3 days with receipt</div>
        {LINE}
        <div style={{ fontSize: '11px', fontWeight: 700 }}>Powered by Tychora</div>
        <div style={{ fontSize: '10px' }}>www.tychora.com</div>
      </div>
    </div>
  )
}