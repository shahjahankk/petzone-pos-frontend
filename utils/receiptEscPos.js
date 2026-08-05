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

/**
 * Convert canvas pixels → ESC/POS GS v 0 raster.
 * Auto-handles dark-background logos (e.g. petzonelogo.png): black bg → paper,
 * colored/light artwork → black dots.
 */
function canvasToEscPosRaster(canvas) {
  const srcW = canvas.width
  const srcH = canvas.height
  const w = Math.floor(srcW / 8) * 8
  const h = srcH
  if (w < 8 || h < 1) return []

  const ctx = canvas.getContext('2d')
  const { data } = ctx.getImageData(0, 0, srcW, srcH)

  // Sample corners — dark corners ⇒ invert mode (print light/colored ink)
  const sample = (x, y) => {
    const i = (Math.min(srcH - 1, Math.max(0, y)) * srcW + Math.min(srcW - 1, Math.max(0, x))) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const cornerAvg =
    (sample(2, 2) +
      sample(srcW - 3, 2) +
      sample(2, srcH - 3) +
      sample(srcW - 3, srcH - 3)) /
    4
  const darkBackground = cornerAvg < 80

  const bytesPerRow = w / 8
  const raster = new Uint8Array(bytesPerRow * h)
  let blackCount = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * srcW + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      if (a < 40) continue

      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      let ink = false
      if (darkBackground) {
        // Black bg stays white on paper; print anything brighter / colored
        const nearBlack = r < 35 && g < 35 && b < 35
        ink = !nearBlack && lum > 25
      } else {
        // Light bg: print dark / saturated pixels
        const nearWhite = r > 245 && g > 245 && b > 245
        ink = !nearWhite && lum < 200
      }

      if (ink) {
        raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
        blackCount += 1
      }
    }
  }
  if (blackCount < 20) return []

  return [
    0x1d,
    0x76,
    0x30,
    0x00,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    h & 0xff,
    (h >> 8) & 0xff,
    ...raster,
  ]
}

function resolveLogoCandidates(logoUrl) {
  const list = []
  const push = (u) => {
    if (u && !list.includes(u)) list.push(u)
  }
  // Prefer real PNG brand mark first
  push('/petzonelogo.png')
  push(logoUrl)
  if (logoUrl?.includes('petzonelogo.svg')) push('/petzonelogo.png')
  if (logoUrl?.includes('petzonelogo.png')) push('/petzonelogo.svg')
  push('/petzonelogo.svg')
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
 * Load petzonelogo.png (or provided URL) → ESC/POS raster for TM-T88V.
 */
export async function logoToEscPosRaster(logoUrl, maxWidthDots = 448) {
  if (typeof window === 'undefined') return []

  const candidates = resolveLogoCandidates(logoUrl)
  let lastError = null

  for (const candidate of candidates) {
    try {
      // Skip SVG for thermal — use PNG brand asset
      if (/\.svg(\?|$)/i.test(candidate)) continue

      const absolute = toAbsoluteUrl(candidate)
      if (!absolute) continue
      const img = await loadImage(absolute)

      let w = img.naturalWidth || img.width
      let h = img.naturalHeight || img.height
      if (!w || !h) continue

      // Fit 80mm printable width (~512 dots max; keep readable height)
      const targetW = Math.min(maxWidthDots, 512)
      if (w > targetW) {
        h = Math.round((h * targetW) / w)
        w = targetW
      }
      // Ensure logo is tall enough to read on paper
      if (h < 72) {
        const scale = 72 / h
        h = 72
        w = Math.floor((w * scale) / 8) * 8
        if (w > 512) {
          h = Math.round((h * 512) / w)
          w = 512
        }
      }
      w = Math.floor(w / 8) * 8
      if (w < 8) continue

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      // White paper underlay (dark PNG bg will still be detected from pixels)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)

      const raster = canvasToEscPosRaster(canvas)
      if (raster.length) return raster
    } catch (e) {
      lastError = e
    }
  }

  if (lastError) console.warn('Logo raster failed:', lastError)
  return []
}

/** Feed well past the cutter, then full cut (TM-T88V cutter sits above print head). */
function cutSafe() {
  return [
    0x0a,
    0x0a,
    0x0a,
    0x1b,
    0x64,
    0x0c, // feed 12 lines
    0x1d,
    0x56,
    0x41,
    0xff, // feed max units then full cut
  ]
}

/**
 * Build full receipt ESC/POS buffer for silent thermal print.
 */
export async function buildReceiptEscPos(printData = {}, options = {}) {
  // TM-T88V 80mm ≈ 42 columns with Font A
  const width = options.width || 42
  const logoUrl = printData.logoUrl || '/petzonelogo.png'
  const includeLogo = options.includeLogo !== false

  const out = []
  out.push(...init())
  out.push(...center())

  let logoPrinted = false
  if (includeLogo) {
    const logo = await logoToEscPosRaster(logoUrl, options.logoWidth || 448)
    if (logo.length) {
      out.push(...logo)
      out.push(...feed(1))
      logoPrinted = true
    }
  }

  // Company / branch name — bold double height (not GS outline style)
  out.push(...style(0x18)) // bold + double height
  out.push(...textLine((printData.companyName || printData.branchName || 'PetZone').slice(0, 24)))
  out.push(...normal())
  out.push(...boldOff())

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
  out.push(...cutSafe())

  return new Uint8Array(out)
}
