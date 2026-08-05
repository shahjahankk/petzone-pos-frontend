import {
  acquirePrinter,
  isThermalPrintingSupported,
  resetCachedPrinter,
  writeToThermalPrinter,
  getPrinterSupportMessage,
  getActivePrinterTransport,
  hasDirectPrinterPaired,
  setPrinterMode,
  PRINTER_MODE_DIRECT,
} from './thermalPrinter'
import { logoToEscPosRaster } from './receiptEscPos'

function esc(...bytes) {
  return bytes
}

function line(str = '') {
  return [...new TextEncoder().encode(String(str)), 0x0a]
}

function boldOn() {
  return esc(0x1b, 0x45, 0x01)
}

function boldOff() {
  return esc(0x1b, 0x45, 0x00)
}

function feed(n = 1) {
  return esc(0x1b, 0x64, Math.max(0, Math.min(255, n)))
}

function cutSafe() {
  return [
    0x0a, 0x0a, 0x0a,
    0x1b, 0x64, 0x0c,
    0x1d, 0x56, 0x41, 0xff,
  ]
}

async function buildTokenCommands(ticketCode, extra = {}) {
  const out = []
  out.push(...esc(0x1b, 0x40))
  out.push(...esc(0x1b, 0x61, 0x01))

  try {
    const logo = await logoToEscPosRaster('/petzonelogo.png', 448)
    if (logo.length) {
      out.push(...logo)
      out.push(...feed(1))
    }
  } catch (e) {
    /* logo optional */
  }

  out.push(...esc(0x1b, 0x21, 0x18))
  out.push(...line('PetZone'))
  out.push(...esc(0x1b, 0x21, 0x00))

  if (extra.serviceName) {
    out.push(...line(String(extra.serviceName).slice(0, 42)))
  }

  out.push(...feed(1))
  out.push(...esc(0x1b, 0x21, 0x30))
  out.push(...boldOn())
  out.push(...line(String(ticketCode)))
  out.push(...boldOff())
  out.push(...esc(0x1b, 0x21, 0x00))
  out.push(...feed(1))

  if (extra.branchName) out.push(...line(String(extra.branchName).slice(0, 42)))
  if (extra.petName) out.push(...line(`Pet: ${String(extra.petName).slice(0, 36)}`))

  const ahead = Number(extra.waitingAhead)
  if (Number.isFinite(ahead) && ahead > 0) {
    out.push(...line(`${ahead} patient(s) ahead of you`))
  } else if (Number.isFinite(ahead) && ahead === 0) {
    out.push(...line('You are next in queue!'))
  }

  const when = extra.issuedAt ? new Date(extra.issuedAt) : new Date()
  out.push(...line(when.toLocaleString()))
  out.push(...feed(1))
  out.push(...line('Please wait for your number to be called'))
  out.push(...feed(1))
  out.push(...line('Powered by Tychora'))
  out.push(...cutSafe())
  return new Uint8Array(out)
}

/**
 * Silent USB/Serial token print. Does NOT open Chrome print dialog
 * unless preferBrowser is explicitly true and no direct printer is paired.
 */
export async function printQueueTicket(ticket, { allowPortRequest = true, preferBrowser = false } = {}) {
  const ticketCode = String(ticket.ticket_code || ticket.ticket_number || '---')
  const extra = {
    serviceName: ticket.service_name,
    branchName: ticket.branch_name,
    waitingAhead: ticket.waiting_ahead,
    issuedAt: ticket.issued_at,
    petName: ticket.pet_name,
  }

  if (!isThermalPrintingSupported()) {
    if (preferBrowser) return printQueueTicketBrowser(ticketCode)
    return {
      success: false,
      message: 'Use Chrome/Edge on desktop and connect USB or Serial/COM for silent print.',
    }
  }

  try {
    setPrinterMode(PRINTER_MODE_DIRECT)
    const paired = await hasDirectPrinterPaired()
    await acquirePrinter({ allowRequest: allowPortRequest || !paired })
    const commands = await buildTokenCommands(ticketCode, extra)
    await writeToThermalPrinter(commands)
    const transport = getActivePrinterTransport()
    const via = transport === 'serial' ? 'serial/COM' : transport === 'usb' ? 'USB' : 'thermal'
    return { success: true, message: `Token ${ticketCode} printed via ${via} (no dialog)`, transport }
  } catch (err) {
    resetCachedPrinter()
    if (preferBrowser) {
      const fallback = await printQueueTicketBrowser(ticketCode)
      if (fallback.success) {
        return {
          success: true,
          message: `Token ${ticketCode} via Chrome dialog (${err.message || 'direct failed'})`,
          usedFallback: true,
        }
      }
    }
    return {
      success: false,
      message:
        err.message ||
        getPrinterSupportMessage() ||
        'Silent print failed. If USB is blocked by Windows, click Serial/COM.',
    }
  }
}

function printQueueTicketBrowser(ticketCode) {
  return new Promise((resolve) => {
    const html = `<!DOCTYPE html>
<html><head><title>Token ${ticketCode}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { margin: 0; padding: 8mm 4mm; text-align: center; font-family: Arial, sans-serif; width: 72mm; }
  .brand { font-weight:900; font-size:24px; margin-bottom: 8px; }
  .num { font-size: 72px; font-weight: 900; color: #1E3A8A; line-height: 1; margin: 16px 0; }
  .hint { font-weight: 700; margin-top: 12px; }
  .footer { margin-top: 16px; font-size: 12px; padding-bottom: 24px; }
</style></head><body>
  <img src="/petzonelogo.svg" alt="PetZone" style="max-width:180px;margin:0 auto 8px;display:block;" onerror="this.style.display='none'">
  <div class="brand">PetZone</div>
  <div class="num">${ticketCode}</div>
  <div class="hint">Please wait for your number to be called</div>
  <div class="footer">Powered by Tychora</div>
</body></html>`

    const w = window.open('', '_blank', 'width=320,height=400')
    if (!w) {
      resolve({ success: false, message: 'Allow popups to print token' })
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => {
      try {
        w.print()
      } catch (e) {
        resolve({ success: false, message: e.message || 'Print failed' })
        return
      }
      setTimeout(() => {
        try { w.close() } catch (e) { /* ignore */ }
        resolve({ success: true, message: `Token ${ticketCode} sent to system printer` })
      }, 800)
    }, 400)
  })
}
