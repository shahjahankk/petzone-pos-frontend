/**
 * ESC/POS sales receipt for Epson TM-T88V 80mm.
 * Full printable width (512 dots) + structured layout (not plain text dump).
 */
import { getPrintLogoSizes } from './brandAssets'

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

function style(n = 0) {
  return bytes(0x1b, 0x21, n & 0xff)
}

function normal() {
  return style(0)
}

/** Double-width + double-height (Font A style bits) */
function emphasize() {
  return style(0x30)
}

function boldOn() {
  return bytes(0x1b, 0x45, 0x01)
}

function boldOff() {
  return bytes(0x1b, 0x45, 0x00)
}

/** Epson TM-T88V 80mm: 512-dot area, Font A pitch, zero extra char gap */
function setup80mm() {
  return [
    0x1b, 0x40,             // ESC @ init
    0x1d, 0x50, 0xb4, 0xb4, // GS P — 180 dpi motion units (TM-T88V)
    0x1b, 0x20, 0x00,       // ESC SP — character spacing 0
    0x1d, 0x21, 0x00,       // GS ! — normal char size
    0x1d, 0x4c, 0x00, 0x00, // GS L — left margin 0
    0x1d, 0x57, 0x00, 0x02, // GS W — print area width 512 dots
    0x1b, 0x4d, 0x00,       // ESC M — Font A (12-dot, 42 cols = full 80mm)
  ]
}

/** Solid graphic rule across full 512 dots — fills paper edge-to-edge */
function fullWidthRule(thickness = 2, dots = 512) {
  const w = Math.floor(dots / 8) * 8
  const bytesPerRow = w / 8
  const body = new Uint8Array(bytesPerRow * thickness)
  body.fill(0xff)
  return [
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    thickness & 0xff, (thickness >> 8) & 0xff,
    ...body,
    0x0a,
  ]
}

function feed(n = 1) {
  return bytes(0x1b, 0x64, Math.max(0, Math.min(255, n)))
}

function pad(str, len, align = 'left') {
  const s = String(str ?? '').slice(0, len)
  if (align === 'right') return s.padStart(len, ' ')
  return s.padEnd(len, ' ')
}

function money(v) {
  return String(Math.round(Number(v || 0)))
}

function rule(width, ch = '-') {
  return textLine(ch.repeat(width))
}

/** Wrap long text into centered lines (no hard truncate). */
function wrapTextLines(str, width) {
  const s = String(str || '').trim()
  if (!s) return []
  if (s.length <= width) return [s]
  const words = s.split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (!cur) {
      if (w.length <= width) cur = w
      else {
        for (let i = 0; i < w.length; i += width) lines.push(w.slice(i, i + width))
      }
      continue
    }
    if ((cur + ' ' + w).length <= width) cur = `${cur} ${w}`
    else {
      lines.push(cur)
      if (w.length <= width) cur = w
      else {
        for (let i = 0; i < w.length; i += width) lines.push(w.slice(i, i + width))
        cur = ''
      }
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function row2(label, value, width) {
  const l = String(label)
  const r = String(value)
  const space = Math.max(1, width - l.length - r.length)
  return textLine(l + ' '.repeat(space) + r)
}

/** Item line — qty / price / total flush to right edge */
function itemLine(item, width) {
  const qty = Number.isFinite(item.quantity) ? item.quantity : 0
  const discountValue = Number(item.discount || 0)
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

  // Font A 42-col layout: keep amounts on the right edge
  const qtyW = 4
  const priceW = 7
  const totW = 7
  const qtyS = String(qty).slice(0, qtyW)
  const priceS = money(unit).slice(0, priceW)
  const totS = money(resolvedTotal).slice(0, totW)
  const nameW = Math.max(8, width - qtyW - priceW - totW)
  const name = String(item.name || 'Item')

  const lines = []
  if (name.length <= nameW) {
    lines.push(
      ...textLine(
        pad(name, nameW) + pad(qtyS, qtyW, 'right') + pad(priceS, priceW, 'right') + pad(totS, totW, 'right')
      )
    )
  } else {
    lines.push(...textLine(name.slice(0, width)))
    if (name.length > width) lines.push(...textLine(name.slice(width, width * 2)))
    lines.push(
      ...textLine(
        pad('', nameW) + pad(qtyS, qtyW, 'right') + pad(priceS, priceW, 'right') + pad(totS, totW, 'right')
      )
    )
  }
  if (discountValue > 0) {
    lines.push(...textLine(pad(`Disc -${money(discountValue)}`, width, 'right')))
  }
  return lines
}

function canvasToEscPosRaster(canvas) {
  const srcW = canvas.width
  const srcH = canvas.height
  const w = Math.floor(srcW / 8) * 8
  const h = srcH
  if (w < 8 || h < 1) return []

  const ctx = canvas.getContext('2d')
  const { data } = ctx.getImageData(0, 0, srcW, srcH)

  const sample = (x, y) => {
    const i = (Math.min(srcH - 1, Math.max(0, y)) * srcW + Math.min(srcW - 1, Math.max(0, x))) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const cornerAvg =
    (sample(2, 2) + sample(srcW - 3, 2) + sample(2, srcH - 3) + sample(srcW - 3, srcH - 3)) / 4
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
        const nearBlack = r < 35 && g < 35 && b < 35
        ink = !nearBlack && lum > 25
      } else {
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

  const header = [0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff]
  const out = new Uint8Array(header.length + raster.length)
  out.set(header, 0)
  out.set(raster, header.length)
  return Array.from(out)
}

function resolveLogoCandidates(logoUrl) {
  const list = []
  const push = (u) => {
    if (u && !list.includes(u)) list.push(u)
  }
  push(logoUrl)
  if (logoUrl?.includes('.svg')) push(String(logoUrl).replace(/\.svg/i, '.png'))
  push('/petzonelogo.png')
  push('/petfamilylogo.png')
  return list
}

function toAbsoluteUrl(logoUrl) {
  if (!logoUrl) return null
  if (/^https?:|^data:/i.test(logoUrl)) return logoUrl
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`
}

async function loadImage(absolute) {
  try {
    const res = await fetch(absolute, { cache: 'no-cache' })
    if (res.ok) {
      const blob = await res.blob()
      if (typeof createImageBitmap === 'function') {
        return createImageBitmap(blob)
      }
      const url = URL.createObjectURL(blob)
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = url
      })
      URL.revokeObjectURL(url)
      return img
    }
  } catch (e) {
    /* fall through */
  }

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

/** Real PNG logo — sized for full 80mm printable width (~512 dots). */
export async function logoToEscPosRaster(logoUrl, maxWidthDots = 512, maxHeightDots = 140) {
  if (typeof window === 'undefined') return []

  const candidates = resolveLogoCandidates(logoUrl)
  let lastError = null

  for (const candidate of candidates) {
    try {
      if (/\.svg(\?|$)/i.test(candidate)) continue
      const absolute = toAbsoluteUrl(candidate)
      if (!absolute) continue
      const img = await loadImage(absolute)

      let w = img.width || img.naturalWidth
      let h = img.height || img.naturalHeight
      if (!w || !h) {
        if (img.close) img.close()
        continue
      }

      const targetW = Math.min(maxWidthDots, 512)
      if (w > targetW) {
        h = Math.round((h * targetW) / w)
        w = targetW
      }
      if (h > maxHeightDots) {
        w = Math.floor((w * maxHeightDots) / h / 8) * 8
        h = maxHeightDots
      }
      w = Math.floor(w / 8) * 8
      if (w < 8) {
        if (img.close) img.close()
        continue
      }

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      if (img.close) img.close()

      const raster = canvasToEscPosRaster(canvas)
      if (raster.length) return raster
    } catch (e) {
      lastError = e
    }
  }

  if (lastError) console.warn('Logo raster failed:', lastError)
  return []
}

function cutSafe() {
  return [
    0x0a, 0x0a, 0x0a, 0x0a, 0x0a,
    0x1d, 0x56, 0x00,
  ]
}

/**
 * Compact ESC/POS sales receipt — Font A 42 cols fills 80mm evenly.
 */
export async function buildReceiptEscPos(printData = {}, options = {}) {
  // Font A on TM-T88V 80mm = 42 columns (12 dots × 42 = 504 of 512) — even side margins
  const width = options.width || 42
  const logoUrl = printData.logoUrl || '/petzonelogo.png'
  const includeLogo = options.includeLogo !== false
  const brandSizes = getPrintLogoSizes(logoUrl)
  const logoWidth = options.logoWidth || Math.min(512, brandSizes.escPosWidth || 512)
  const logoHeight = options.logoHeight || brandSizes.escPosHeight || 140

  const brandName =
    printData.companyName || printData.branchName || 'PetZone'
  const title = String(printData.title || 'SALES RECEIPT').toUpperCase()

  const out = []
  out.push(...setup80mm())
  out.push(...center())

  if (includeLogo) {
    const logo = await logoToEscPosRaster(logoUrl, logoWidth, logoHeight)
    if (logo.length) {
      out.push(...logo)
      out.push(...feed(1))
    }
  }

  // Brand — normal Font A, wraps (never truncates)
  out.push(...boldOn())
  for (const line of wrapTextLines(brandName, width)) {
    out.push(...textLine(line))
  }
  out.push(...boldOff())

  if (printData.branchName && printData.branchName !== printData.companyName) {
    for (const line of wrapTextLines(printData.branchName, width)) {
      out.push(...textLine(line))
    }
  }
  if (printData.companyAddress) {
    for (const line of wrapTextLines(printData.companyAddress, width)) {
      out.push(...textLine(line))
    }
  }
  if (printData.companyPhone) {
    out.push(...textLine(`Tel: ${String(printData.companyPhone).slice(0, width - 5)}`))
  }
  if (printData.companyEmail) {
    out.push(...textLine(String(printData.companyEmail).slice(0, width)))
  }

  out.push(...fullWidthRule(2))
  out.push(...boldOn())
  out.push(...textLine(pad(title.slice(0, width), width)))
  out.push(...boldOff())
  out.push(...fullWidthRule(2))

  // Meta
  out.push(...left())
  out.push(...boldOn())
  out.push(...row2('Receipt #', printData.receiptNumber || 'N/A', width))
  out.push(...boldOff())
  const dateTime = [printData.date, printData.time].filter(Boolean).join(' ')
  if (dateTime) out.push(...row2('Date/Time', dateTime.slice(0, width - 10), width))
  out.push(...row2('Cashier', printData.cashierName || 'N/A', width))
  out.push(...row2('Customer', (printData.customerName || 'Walk-in').slice(0, width - 10), width))
  if (printData.customerPhone) {
    out.push(...row2('Phone', printData.customerPhone, width))
  }

  out.push(...fullWidthRule(2))

  // Items
  const qtyW = 4
  const priceW = 7
  const totW = 7
  const nameHdrW = Math.max(8, width - qtyW - priceW - totW)
  out.push(
    ...boldOn(),
    ...textLine(
      pad('ITEM', nameHdrW) + pad('QTY', qtyW, 'right') + pad('PRICE', priceW, 'right') + pad('TOTAL', totW, 'right')
    ),
    ...boldOff()
  )
  out.push(...rule(width, '-'))

  const items = Array.isArray(printData.items) ? printData.items : []
  items.forEach((item) => {
    out.push(...itemLine(item, width))
  })

  out.push(...fullWidthRule(2))

  // Totals
  const subtotal = printData.subtotal || 0
  const tax = printData.tax || 0
  const cartDiscount = Number(printData.discount || 0)
  const itemDiscountSum = items.reduce((sum, item) => sum + Number(item.discount || 0), 0)
  const invoiceTotal =
    printData.invoiceTotal !== undefined
      ? printData.invoiceTotal
      : subtotal + tax - cartDiscount
  const oldBalance = Math.max(0, printData.oldBalance || 0)
  const total =
    printData.total !== undefined ? printData.total : invoiceTotal + oldBalance
  const paymentAmount = printData.paymentAmount || 0
  const creditAmount = printData.creditAmount || 0
  const remaining = Math.max(0, oldBalance + invoiceTotal - paymentAmount)
  const change = paymentAmount > total ? paymentAmount - total : 0

  out.push(...row2('Subtotal', money(subtotal), width))
  if (itemDiscountSum > 0) out.push(...row2('Item Disc', `-${money(itemDiscountSum)}`, width))
  if (cartDiscount > 0) out.push(...row2('Discount', `-${money(cartDiscount)}`, width))
  if (tax > 0) out.push(...row2('Tax', money(tax), width))
  if (invoiceTotal !== total || oldBalance > 0) {
    out.push(...row2('Invoice', money(invoiceTotal), width))
  }
  if (oldBalance > 0) out.push(...row2('Old Balance', money(oldBalance), width))

  out.push(...fullWidthRule(3))
  out.push(...center())
  out.push(...boldOn())
  out.push(...emphasize())
  out.push(...textLine(`TOTAL ${money(total)}`.slice(0, 21)))
  out.push(...normal())
  out.push(...boldOff())
  out.push(...fullWidthRule(3))

  // Payment
  out.push(...left())
  out.push(...row2('Paid', `${printData.paymentMethod || 'CASH'} ${money(paymentAmount)}`, width))
  if (creditAmount > 0 || printData.paymentMethod === 'FULLY_CREDIT') {
    out.push(...row2('Credit', money(creditAmount || total), width))
  }
  if (remaining > 0 || (oldBalance > 0 && paymentAmount < total)) {
    out.push(...boldOn())
    out.push(...row2('Remaining', money(remaining), width))
    out.push(...boldOff())
  }
  if (change > 0) out.push(...row2('Change', money(change), width))

  if (printData.notes && String(printData.notes).trim()) {
    out.push(...rule(width, '-'))
    out.push(...textLine('Notes:'))
    out.push(...textLine(String(printData.notes).slice(0, width * 2)))
  }

  // Footer
  out.push(...center())
  out.push(...fullWidthRule(1))
  out.push(...boldOn())
  out.push(...textLine(printData.footerMessage || 'Thank you for choosing us!'))
  out.push(...boldOff())
  out.push(...textLine('Return within 3 days with receipt'))
  out.push(...textLine('Powered by Tychora'))
  out.push(...textLine('www.tychora.com'))
  out.push(...cutSafe())

  return new Uint8Array(out)
}
