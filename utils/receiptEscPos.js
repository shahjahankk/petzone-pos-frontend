/**
 * Build ESC/POS bytes for a PetZone sales receipt (silent USB/Serial print).
 * Tuned for Epson TM-T88V 80mm (≈42 cols Font A).
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

/** ESC ! n — bit3 bold, bit4 double-H, bit5 double-W */
function style(n = 0) {
  return bytes(0x1b, 0x21, n & 0xff)
}

function normal() {
  return style(0)
}

/** GS ! n — size multiplier (more reliable on Epson) */
function charSize(n = 0) {
  return bytes(0x1d, 0x21, n & 0xff)
}

function boldOn() {
  return bytes(0x1b, 0x45, 0x01)
}

function boldOff() {
  return bytes(0x1b, 0x45, 0x00)
}

function init() {
  return bytes(0x1b, 0x40)
}

function feed(n = 1) {
  return bytes(0x1b, 0x64, Math.max(0, Math.min(255, n)))
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

function row2(label, value, width = 42) {
  const l = String(label)
  const r = String(value)
  const space = Math.max(1, width - l.length - r.length)
  return textLine(l + ' '.repeat(space) + r)
}

function itemBlock(item, width = 42) {
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
  for (let i = 0; i < name.length; i += width) {
    lines.push(...boldOn(), ...textLine(name.slice(i, i + width)), ...boldOff())
  }
  const leftPart = `${qty} x ${money(unit)}`
  const rightPart = money(resolvedTotal)
  const dots = Math.max(1, width - leftPart.length - rightPart.length)
  lines.push(...textLine(leftPart + ' '.repeat(dots) + rightPart))
  return lines
}

function resolveLogoCandidates(logoUrl) {
  const list = []
  const push = (u) => {
    if (u && !list.includes(u)) list.push(u)
  }
  push(logoUrl)
  // Repo ships SVG; many call sites still request missing .png
  if (logoUrl?.includes('petzonelogo.png')) push('/petzonelogo.svg')
  if (logoUrl?.includes('petzonelogo.svg')) push('/petzonelogo.png')
  push('/petzonelogo.svg')
  push('/petzonelogo.png')
  return list
}

function toAbsoluteUrl(logoUrl) {
  if (!logoUrl) return null
  if (/^https?:|^data:/i.test(logoUrl)) return logoUrl
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`
}

async function loadImage(absolute) {
  const img = new Image()
  const isSameOrigin =
    absolute.startsWith('data:') ||
    (typeof window !== 'undefined' && absolute.startsWith(window.location.origin))
  if (!isSameOrigin) img.crossOrigin = 'anonymous'

  await new Promise((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Logo load failed: ${absolute}`))
    img.src = absolute
  })
  return img
}

/**
 * Convert image URL to ESC/POS raster (GS v 0).
 * Tries PNG then SVG; treats any non-near-white pixel as black (thermal-friendly).
 */
export async function logoToEscPosRaster(logoUrl, maxWidthDots = 384) {
  if (typeof window === 'undefined') return []

  const candidates = resolveLogoCandidates(logoUrl)
  let lastError = null

  for (const candidate of candidates) {
    try {
      const absolute = toAbsoluteUrl(candidate)
      if (!absolute) continue
      const img = await loadImage(absolute)

      let w = img.naturalWidth || img.width
      let h = img.naturalHeight || img.height
      if (!w || !h) continue

      // SVG often reports 0 until drawn — use intrinsic attrs / fallback
      if ((!w || !h) && candidate.endsWith('.svg')) {
        w = 512
        h = 128
      }

      if (w > maxWidthDots) {
        h = Math.round((h * maxWidthDots) / w)
        w = maxWidthDots
      }
      // Keep a readable logo height on 80mm paper
      if (h < 48) {
        const scale = 48 / h
        h = 48
        w = Math.floor((w * scale) / 8) * 8
      }
      w = Math.floor(w / 8) * 8
      if (w < 8) continue

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
      let blackCount = 0

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          // Near-white → paper; everything else → black (captures light pink logos)
          const nearWhite = r > 245 && g > 245 && b > 245
          const black = a > 40 && !nearWhite
          if (black) {
            raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
            blackCount += 1
          }
        }
      }

      // Empty/white logo → skip (try next candidate)
      if (blackCount < 20) continue

      const xL = bytesPerRow & 0xff
      const xH = (bytesPerRow >> 8) & 0xff
      const yL = h & 0xff
      const yH = (h >> 8) & 0xff

      // GS v 0 m=0 normal density
      return [0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...raster]
    } catch (e) {
      lastError = e
    }
  }

  if (lastError) console.warn('Logo raster failed:', lastError)
  return []
}

/**
 * Build full receipt ESC/POS buffer for silent thermal print.
 */
export async function buildReceiptEscPos(printData = {}, options = {}) {
  // TM-T88V 80mm ≈ 42 columns with Font A
  const width = options.width || 42
  const logoUrl = printData.logoUrl || '/petzonelogo.svg'
  const includeLogo = options.includeLogo !== false

  const out = []
  out.push(...init())
  out.push(...center())

  let logoPrinted = false
  if (includeLogo) {
    const logo = await logoToEscPosRaster(logoUrl, options.logoWidth || 384)
    if (logo.length) {
      out.push(...logo)
      out.push(...feed(1))
      logoPrinted = true
    }
  }

  // Brand / company — large + bold (always, even if logo missing)
  out.push(...charSize(0x11)) // 2× width & height
  out.push(...boldOn())
  out.push(...textLine((printData.companyName || printData.branchName || 'PetZone').slice(0, 20)))
  out.push(...boldOff())
  out.push(...charSize(0x00))
  out.push(...normal())

  if (!logoPrinted) {
    out.push(...boldOn())
    out.push(...textLine('PETZONE'))
    out.push(...boldOff())
  }

  if (printData.branchName && printData.branchName !== printData.companyName) {
    out.push(...boldOn())
    out.push(...textLine(String(printData.branchName).slice(0, width)))
    out.push(...boldOff())
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
  out.push(...charSize(0x01)) // double height title
  out.push(...boldOn())
  out.push(...textLine((printData.title || 'SALES RECEIPT').toUpperCase().slice(0, width)))
  out.push(...boldOff())
  out.push(...charSize(0x00))
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
  // Item | Qty | Price | Total  (42 cols: 18+5+9+10)
  out.push(
    ...boldOn(),
    ...textLine(
      pad('Item', 18) + pad('Qty', 5, 'right') + pad('Price', 9, 'right') + pad('Total', 10, 'right')
    ),
    ...boldOff()
  )
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
  out.push(...center())
  out.push(...charSize(0x11))
  out.push(...boldOn())
  out.push(...textLine(`TOTAL: ${money(total)}`))
  out.push(...boldOff())
  out.push(...charSize(0x00))
  out.push(...normal())
  out.push(...left())
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
  out.push(...boldOn())
  out.push(...textLine(printData.footerMessage || 'Thank you for your business!'))
  out.push(...boldOff())
  out.push(...textLine('Return within 3 days'))
  out.push(...textLine('='.repeat(width)))
  out.push(...textLine('Powered by Tychora'))
  out.push(...textLine('www.tychora.com'))
  out.push(...feed(3))
  out.push(...cut())

  return new Uint8Array(out)
}
