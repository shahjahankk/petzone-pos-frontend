/**
 * Build ESC/POS bytes for a PetZone sales receipt (silent USB/Serial print).
 * Includes raster logo + monospace column alignment (no browser print dialog).
 */

const encoder = () => new TextEncoder()

function bytes(...arr) {
  return arr
}

function textLine(str = '') {
  return [...encoder().encode(String(str)), 0x0a]
}

function center() {
  return bytes(0x1b, 0x61, 0x01)
}

function left() {
  return bytes(0x1b, 0x61, 0x00)
}

function normal() {
  return bytes(0x1b, 0x21, 0x00)
}

function doubleSize() {
  return bytes(0x1b, 0x21, 0x30)
}

function emphasize() {
  return bytes(0x1b, 0x21, 0x08)
}

function init() {
  return bytes(0x1b, 0x40)
}

function cut() {
  return bytes(0x1d, 0x56, 0x00)
}

function pad(str, len, align = 'left') {
  const s = String(str ?? '').slice(0, len)
  if (align === 'right') return s.padStart(len, ' ')
  if (align === 'center') {
    const leftPad = Math.floor((len - s.length) / 2)
    return s.padStart(leftPad + s.length, ' ').padEnd(len, ' ')
  }
  return s.padEnd(len, ' ')
}

function money(v) {
  return String(Math.round(Number(v || 0)))
}

function row2(label, value, width = 32) {
  const l = String(label)
  const r = String(value)
  const space = Math.max(1, width - l.length - r.length)
  return textLine(l + ' '.repeat(space) + r)
}

function itemBlock(item, width = 32) {
  const name = item.name || 'Item'
  const qty = Number.isFinite(item.quantity) ? item.quantity : 0
  const discountValue = Number.isFinite(item.discount) ? item.discount : 0
  const resolvedTotal = Number.isFinite(item.total)
    ? item.total
    : Number(item.unitPrice || item.price || 0) * qty - discountValue
  const unit =
    Number.isFinite(item.unitPrice) && item.unitPrice !== 0
      ? item.unitPrice
      : Number.isFinite(item.price) && item.price !== 0
        ? item.price
        : qty
          ? (resolvedTotal + discountValue) / qty
          : 0

  const lines = []
  // Name on its own line (wrap ~32 chars)
  for (let i = 0; i < name.length; i += width) {
    lines.push(...textLine(name.slice(i, i + width)))
  }
  // qty x price ............ total
  const leftPart = `${qty} x ${money(unit)}`
  const rightPart = money(resolvedTotal)
  const dots = Math.max(1, width - leftPart.length - rightPart.length)
  lines.push(...textLine(leftPart + ' '.repeat(dots) + rightPart))
  return lines
}

/**
 * Convert image URL to ESC/POS raster (GS v 0).
 * Returns empty array if logo cannot be loaded.
 */
export async function logoToEscPosRaster(logoUrl, maxWidthDots = 240) {
  if (typeof window === 'undefined' || !logoUrl) return []

  try {
    const absolute = /^https?:|^data:/i.test(logoUrl)
      ? logoUrl
      : `${window.location.origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`

    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = absolute
    })

    let w = img.naturalWidth || img.width
    let h = img.naturalHeight || img.height
    if (!w || !h) return []

    if (w > maxWidthDots) {
      h = Math.round((h * maxWidthDots) / w)
      w = maxWidthDots
    }
    // width must be multiple of 8 for raster
    w = Math.floor(w / 8) * 8
    if (w < 8) return []

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    const { data } = ctx.getImageData(0, 0, w, h)
    const bytesPerRow = w / 8
    const raster = new Uint8Array(bytesPerRow * h)

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]
        // Dark pixels print as black (threshold)
        const lum = 0.299 * r + 0.587 * g + 0.114 * b
        const black = a > 128 && lum < 180
        if (black) {
          raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
        }
      }
    }

    const xL = bytesPerRow & 0xff
    const xH = (bytesPerRow >> 8) & 0xff
    const yL = h & 0xff
    const yH = (h >> 8) & 0xff

    // GS v 0 m xL xH yL yH d...  (m=0 normal)
    return [0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...raster]
  } catch (e) {
    console.warn('Logo raster failed:', e)
    return []
  }
}

/**
 * Build full receipt ESC/POS buffer for silent thermal print.
 */
export async function buildReceiptEscPos(printData = {}, options = {}) {
  const width = options.width || 32
  const logoUrl = printData.logoUrl || '/petzonelogo.png'
  const includeLogo = options.includeLogo !== false

  const out = []
  out.push(...init())
  out.push(...center())

  if (includeLogo) {
    const logo = await logoToEscPosRaster(logoUrl, options.logoWidth || 240)
    if (logo.length) {
      out.push(...logo)
      out.push(...textLine(''))
    }
  }

  out.push(...doubleSize())
  out.push(...textLine((printData.companyName || printData.branchName || 'PetZone').slice(0, 16)))
  out.push(...normal())
  if (printData.branchName && printData.branchName !== printData.companyName) {
    out.push(...textLine(String(printData.branchName).slice(0, width)))
  }
  if (printData.companyAddress) {
    out.push(...textLine(String(printData.companyAddress).slice(0, width)))
  }
  if (printData.companyPhone) {
    out.push(...textLine(`Tel: ${String(printData.companyPhone).slice(0, width - 5)}`))
  }
  if (printData.companyEmail) {
    out.push(...textLine(String(printData.companyEmail).slice(0, width)))
  }

  out.push(...textLine('='.repeat(width)))
  out.push(...emphasize())
  out.push(...textLine((printData.title || 'SALES RECEIPT').toUpperCase()))
  out.push(...normal())
  out.push(...textLine('='.repeat(width)))

  out.push(...left())
  out.push(...row2('Receipt #:', printData.receiptNumber || 'N/A', width))
  out.push(...row2('Date:', printData.date || '', width))
  if (printData.time) out.push(...row2('Time:', printData.time, width))
  out.push(...row2('Cashier:', printData.cashierName || 'N/A', width))
  out.push(...row2('Customer:', printData.customerName || 'Walk-in', width))
  if (printData.customerPhone) {
    out.push(...row2('Phone:', printData.customerPhone, width))
  }

  out.push(...textLine('-'.repeat(width)))
  out.push(...textLine(pad('Item', 14) + pad('Qty', 4, 'right') + pad('Price', 7, 'right') + pad('Total', 7, 'right')))
  out.push(...textLine('-'.repeat(width)))

  const items = Array.isArray(printData.items) ? printData.items : []
  items.forEach((item) => {
    out.push(...itemBlock(item, width))
  })

  out.push(...textLine('-'.repeat(width)))

  const subtotal = printData.subtotal || 0
  const tax = printData.tax || 0
  const discount = printData.discount || 0
  const invoiceTotal =
    printData.invoiceTotal !== undefined
      ? printData.invoiceTotal
      : subtotal + tax - discount
  const oldBalance = Math.max(0, printData.oldBalance || 0)
  const total =
    printData.total !== undefined ? printData.total : invoiceTotal + oldBalance
  const paymentAmount = printData.paymentAmount || 0
  const creditAmount = printData.creditAmount || 0
  const remaining = Math.max(0, oldBalance + invoiceTotal - paymentAmount)
  const change = paymentAmount > total ? paymentAmount - total : 0

  out.push(...row2('Subtotal:', money(subtotal), width))
  if (discount > 0) out.push(...row2('Discount:', `-${money(discount)}`, width))
  if (tax > 0) out.push(...row2('Tax:', money(tax), width))
  out.push(...row2('Invoice Total:', money(invoiceTotal), width))
  if (oldBalance > 0) out.push(...row2('Old Balance:', money(oldBalance), width))
  out.push(...textLine('='.repeat(width)))
  out.push(...emphasize())
  out.push(...row2('TOTAL:', money(total), width))
  out.push(...normal())
  out.push(...row2('Payment:', printData.paymentMethod || 'CASH', width))
  out.push(...row2('Paid:', money(paymentAmount), width))
  if (creditAmount > 0 || printData.paymentMethod === 'FULLY_CREDIT') {
    out.push(...row2('Credit:', money(creditAmount || total), width))
  }
  if (remaining > 0 || oldBalance > 0) {
    out.push(...row2('Remaining:', money(remaining), width))
  }
  if (change > 0) out.push(...row2('Change:', money(change), width))

  if (printData.notes && String(printData.notes).trim()) {
    out.push(...textLine('-'.repeat(width)))
    out.push(...textLine(String(printData.notes).slice(0, width * 2)))
  }

  out.push(...center())
  out.push(...textLine('='.repeat(width)))
  out.push(...textLine(printData.footerMessage || 'Thank you for your business!'))
  out.push(...textLine('Return within 3 days'))
  out.push(...textLine('='.repeat(width)))
  out.push(...textLine('Powered by Tychora'))
  out.push(...textLine('www.tychora.com'))
  out.push(...textLine(''))
  out.push(...textLine(''))
  out.push(...cut())

  return new Uint8Array(out)
}
