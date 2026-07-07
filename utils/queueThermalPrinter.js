import {
  acquirePrinter,
  isThermalPrintingSupported,
  isSystemPrinterMode,
  resetCachedPrinter,
  writeToThermalPrinter,
  getPrinterSupportMessage,
} from './thermalPrinter'

function esc(...bytes) {
  return bytes
}

function line(str = '') {
  return [...new TextEncoder().encode(str), 0x0A]
}

const LOGO_URL = '/petzonelogo.svg'

/**
 * Minimal queue slip: PetZone logo + token number only (28, 29, …)
 */
export async function printQueueTicket(ticket, { allowPortRequest = true } = {}) {
  const ticketCode = String(ticket.ticket_code || ticket.ticket_number || '---')

  if (isSystemPrinterMode() || !isThermalPrintingSupported()) {
    return printQueueTicketBrowser(ticketCode)
  }

  try {
    await acquirePrinter({ allowRequest: allowPortRequest })

    const commands = [
      ...esc(0x1B, 0x40),
      ...esc(0x1B, 0x61, 0x01),
      ...esc(0x1B, 0x21, 0x30),
      ...line('PetZone'),
      ...esc(0x1B, 0x21, 0x00),
      ...line(''),
      ...esc(0x1B, 0x21, 0x38),
      ...line(ticketCode),
      ...esc(0x1B, 0x21, 0x00),
      ...line(''),
      ...line(''),
      ...esc(0x1D, 0x56, 0x00),
    ]

    await writeToThermalPrinter(new Uint8Array(commands))
    return { success: true, message: `Token ${ticketCode} printed` }
  } catch (err) {
    resetCachedPrinter()
    const fallback = await printQueueTicketBrowser(ticketCode)
    if (fallback.success) return { success: true, message: 'Printed via browser', usedFallback: true }
    throw new Error(err.message || getPrinterSupportMessage())
  }
}

function printQueueTicketBrowser(ticketCode) {
  return new Promise((resolve) => {
    const html = `<!DOCTYPE html>
<html><head><title>Token ${ticketCode}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { margin: 0; padding: 8mm 4mm; text-align: center; font-family: Arial, sans-serif; width: 72mm; }
  img { width: 140px; height: auto; margin-bottom: 8px; }
  .num { font-size: 72px; font-weight: 900; color: #1E3A8A; line-height: 1; margin: 16px 0; }
</style></head><body>
  <img src="${LOGO_URL}" alt="PetZone" onerror="this.style.display='none'">
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
    setTimeout(() => { w.print(); setTimeout(() => w.close(), 400) }, 300)
    resolve({ success: true, message: 'Print dialog opened' })
  })
}
