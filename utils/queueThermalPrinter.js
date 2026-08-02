import {
  acquirePrinter,
  isThermalPrintingSupported,
  isSystemPrinterMode,
  resetCachedPrinter,
  writeToThermalPrinter,
  getPrinterSupportMessage,
  getActivePrinterTransport,
} from './thermalPrinter'
import { PETZONE_LOGO_SVG, resolvePetzoneLogoUrl } from './brandAssets'

function esc(...bytes) {
  return bytes
}

function line(str = '') {
  return [...new TextEncoder().encode(str), 0x0a]
}

/**
 * Print queue token to connected thermal printer (WebUSB / Serial ESC/POS).
 * Falls back to browser print dialog for system-printer mode or when direct print fails.
 */
export async function printQueueTicket(ticket, { allowPortRequest = true } = {}) {
  const ticketCode = String(ticket.ticket_code || ticket.ticket_number || '---')

  if (isSystemPrinterMode() || !isThermalPrintingSupported()) {
    return printQueueTicketBrowser(ticketCode)
  }

  try {
    await acquirePrinter({ allowRequest: allowPortRequest })

    const commands = [
      ...esc(0x1b, 0x40),
      ...esc(0x1b, 0x61, 0x01),
      ...esc(0x1b, 0x21, 0x30),
      ...line('PetZone'),
      ...esc(0x1b, 0x21, 0x00),
      ...line(''),
      ...esc(0x1b, 0x21, 0x38),
      ...line(ticketCode),
      ...esc(0x1b, 0x21, 0x00),
      ...line(''),
      ...line(''),
      ...esc(0x1d, 0x56, 0x00),
    ]

    await writeToThermalPrinter(new Uint8Array(commands))
    const transport = getActivePrinterTransport()
    const via = transport === 'serial' ? 'serial/COM' : transport === 'usb' ? 'USB' : 'thermal'
    return { success: true, message: `Token ${ticketCode} printed via ${via}`, transport }
  } catch (err) {
    resetCachedPrinter()
    const fallback = await printQueueTicketBrowser(ticketCode)
    if (fallback.success) {
      return {
        success: true,
        message: `Token ${ticketCode} printed via browser (${err.message || 'direct print failed'})`,
        usedFallback: true,
      }
    }
    throw new Error(err.message || getPrinterSupportMessage())
  }
}

function printQueueTicketBrowser(ticketCode) {
  return new Promise((resolve) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const logoPng = resolvePetzoneLogoUrl(origin)
    const logoSvg = origin ? `${origin}${PETZONE_LOGO_SVG}` : PETZONE_LOGO_SVG

    const html = `<!DOCTYPE html>
<html><head><title>Token ${ticketCode}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { margin: 0; padding: 8mm 4mm; text-align: center; font-family: Arial, sans-serif; width: 72mm; }
  img { max-width: 100px; width: 100px; height: auto; filter: grayscale(100%); display: block; margin: 0 auto 12px; }
  .num { font-size: 72px; font-weight: 900; color: #1E3A8A; line-height: 1; margin: 16px 0; }
</style></head><body>
  <img src="${logoPng}" alt="PetZone" onerror="this.onerror=null;this.src='${logoSvg}'">
  <div class="num">${ticketCode}</div>
</body></html>`

    const w = window.open('', '_blank', 'width=320,height=400')
    if (!w) {
      resolve({ success: false, message: 'Allow popups to print token' })
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()

    let settled = false
    const finish = (ok, message) => {
      if (settled) return
      settled = true
      try {
        w.close()
      } catch (e) {
        /* ignore */
      }
      resolve({ success: ok, message })
    }

    w.onafterprint = () => finish(true, `Token ${ticketCode} sent to system printer`)

    setTimeout(() => {
      try {
        w.print()
      } catch (e) {
        finish(false, e.message || 'Print failed')
        return
      }
      setTimeout(() => finish(true, `Token ${ticketCode} sent to system printer`), 5000)
    }, 500)
  })
}
