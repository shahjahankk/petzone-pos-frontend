import { PETZONE_LOGO_PNG, PETZONE_LOGO_SVG, resolvePetzoneLogoUrl } from './brandAssets'

/**
 * Print queue token slip with the same PetZone logo as POS receipts + number (28, 29, …)
 */
export async function printQueueTicket(ticket) {
  const ticketCode = String(ticket.ticket_code || ticket.ticket_number || '---')
  return printQueueTicketBrowser(ticketCode)
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
    setTimeout(() => { w.print(); setTimeout(() => w.close(), 400) }, 400)
    resolve({ success: true, message: `Token ${ticketCode} sent to printer` })
  })
}
