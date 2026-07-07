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

function text(str) {
  return [...new TextEncoder().encode(str)]
}

function line(str = '') {
  return [...text(str), 0x0A]
}

/**
 * Print a queue ticket slip on the thermal printer (80mm).
 * @param {Object} ticket - ticket data from API
 */
export async function printQueueTicket(ticket, { allowPortRequest = true } = {}) {
  const ticketCode = ticket.ticket_code || '---'
  const serviceName = ticket.service_name || 'Service'
  const branchName = ticket.branch_name || 'PetZone Clinic'
  const issuedAt = ticket.issued_at
    ? new Date(ticket.issued_at).toLocaleString()
    : new Date().toLocaleString()
  const waitingMsg = ticket.waiting_ahead > 0
    ? `${ticket.waiting_ahead} patient(s) ahead`
    : 'You are next in queue!'

  if (isSystemPrinterMode() || !isThermalPrintingSupported()) {
    return printQueueTicketBrowser(ticket)
  }

  try {
    await acquirePrinter({ allowRequest: allowPortRequest })

    const commands = [
      ...esc(0x1B, 0x40), // init
      ...esc(0x1B, 0x61, 0x01), // center
      ...esc(0x1B, 0x21, 0x30), // double size
      ...line('PETZONE CLINIC'),
      ...esc(0x1B, 0x21, 0x00),
      ...line('Queue Token'),
      ...line('================================'),
      ...esc(0x1B, 0x21, 0x38), // largest
      ...line(ticketCode),
      ...esc(0x1B, 0x21, 0x00),
      ...line('================================'),
      ...esc(0x1B, 0x61, 0x00), // left
      ...line(`Service: ${serviceName}`),
      ...line(`Branch: ${branchName}`),
    ]

    if (ticket.pet_name) commands.push(...line(`Pet: ${ticket.pet_name}`))
    if (ticket.owner_name) commands.push(...line(`Owner: ${ticket.owner_name}`))

    commands.push(
      ...line('--------------------------------'),
      ...line(waitingMsg),
      ...line(`Issued: ${issuedAt}`),
      ...line('--------------------------------'),
      ...esc(0x1B, 0x61, 0x01),
      ...line('Please wait for your'),
      ...line('number to be called'),
      ...line(''),
      ...line('Thank you!'),
      ...line(''),
      ...line(''),
      ...esc(0x1D, 0x56, 0x00), // cut
    )

    await writeToThermalPrinter(new Uint8Array(commands))
    return { success: true, message: 'Ticket printed' }
  } catch (err) {
    resetCachedPrinter()
    const fallback = await printQueueTicketBrowser(ticket)
    if (fallback.success) return { success: true, message: 'Printed via browser', usedFallback: true }
    throw new Error(err.message || getPrinterSupportMessage())
  }
}

function printQueueTicketBrowser(ticket) {
  return new Promise((resolve) => {
    const ticketCode = ticket.ticket_code || '---'
    const html = `
      <html><head><title>Queue Token ${ticketCode}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: monospace; text-align: center; width: 72mm; margin: 0 auto; }
        .logo { font-size: 16px; font-weight: bold; }
        .num { font-size: 48px; font-weight: 900; margin: 12px 0; }
        .svc { font-size: 14px; }
        .meta { font-size: 11px; color: #444; line-height: 1.6; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
      </style></head><body>
        <div class="logo">PETZONE CLINIC</div>
        <div>Queue Token</div>
        <hr>
        <div class="num">${ticketCode}</div>
        <hr>
        <div class="svc">${ticket.service_name || ''}</div>
        <div class="meta">
          ${ticket.branch_name || ''}<br>
          ${ticket.pet_name ? `Pet: ${ticket.pet_name}<br>` : ''}
          ${ticket.owner_name ? `Owner: ${ticket.owner_name}<br>` : ''}
          ${ticket.waiting_ahead > 0 ? `${ticket.waiting_ahead} ahead<br>` : 'You are next!<br>'}
          ${new Date(ticket.issued_at || Date.now()).toLocaleString()}
        </div>
        <hr>
        <div class="meta">Please wait for your number to be called</div>
      </body></html>`

    const w = window.open('', '_blank', 'width=320,height=480')
    if (!w) {
      resolve({ success: false, message: 'Popup blocked — allow popups to print' })
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
    setTimeout(() => { w.close() }, 500)
    resolve({ success: true, message: 'Print dialog opened' })
  })
}
