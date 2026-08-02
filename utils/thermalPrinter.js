/**
 * Unified thermal printer transport: WebUSB (Epson/native USB) + Web Serial (COM/virtual serial).
 * Epson TM-series usually needs WebUSB — they rarely show in the serial port picker.
 */

const SERIAL_STORAGE_KEY = 'thermalSerialPortInfo'
const USB_STORAGE_KEY = 'thermalUsbDeviceInfo'
const PERMISSION_KEY = 'printerPermissionGranted'
const TRANSPORT_KEY = 'thermalPrinterTransport'
const PRINTER_MODE_KEY = 'posPrinterMode'

export const PRINTER_MODE_DIRECT = 'direct'
export const PRINTER_MODE_SYSTEM = 'system'

export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200]

export const SERIAL_OPEN_BASE = {
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
}

/** Seiko Epson Corp — TM-T20, TM-T82, TM-T88, etc. */
export const THERMAL_USB_FILTERS = [
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0519 }, // Star Micronics
  { vendorId: 0x1504 }, // Bixolon
  { vendorId: 0x0fe6 }, // Common generic thermal (e.g. some 80mm)
]

const USB_CHUNK_SIZE = 4096

let cachedTransport = null // 'usb' | 'serial'
let cachedUsbDevice = null
let cachedSerialPort = null
let cachedSerialPortInfo = null

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial
}

export function isWebUsbSupported() {
  return typeof navigator !== 'undefined' && !!navigator.usb
}

export function isThermalPrintingSupported() {
  return isWebUsbSupported() || isWebSerialSupported()
}

export function resetCachedPrinter() {
  cachedTransport = null
  cachedUsbDevice = null
  cachedSerialPort = null
  cachedSerialPortInfo = null
}

export const resetCachedSerialPort = resetCachedPrinter

function persistPermission(transport) {
  try {
    sessionStorage.setItem(PERMISSION_KEY, '1')
    if (transport) sessionStorage.setItem(TRANSPORT_KEY, transport)
  } catch (e) {
    /* ignore */
  }
}

function persistUsbInfo(device) {
  if (!device) return
  try {
    sessionStorage.setItem(
      USB_STORAGE_KEY,
      JSON.stringify({ vendorId: device.vendorId, productId: device.productId })
    )
    persistPermission('usb')
  } catch (e) {
    /* ignore */
  }
}

function loadUsbInfo() {
  try {
    const raw = sessionStorage.getItem(USB_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function persistSerialInfo(info) {
  if (!info) return
  try {
    sessionStorage.setItem(SERIAL_STORAGE_KEY, JSON.stringify(info))
    persistPermission('serial')
  } catch (e) {
    /* ignore */
  }
}

function loadSerialInfo() {
  try {
    const raw = sessionStorage.getItem(SERIAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function matchUsbDevice(devices, info) {
  if (!devices?.length) return null
  if (!info) return devices[0]
  return (
    devices.find(
      (d) => d.vendorId === info.vendorId && d.productId === info.productId
    ) || devices[0]
  )
}

function matchSerialPort(ports, info) {
  if (!ports?.length) return null
  if (!info) return ports[0]
  return (
    ports.find((port) => {
      if (typeof port.getInfo !== 'function') return false
      const portInfo = port.getInfo()
      return (
        portInfo &&
        portInfo.usbVendorId === info.usbVendorId &&
        portInfo.usbProductId === info.usbProductId
      )
    }) || ports[0]
  )
}

function cacheSerialPort(port) {
  cachedTransport = 'serial'
  cachedSerialPort = port
  cachedUsbDevice = null
  if (port && typeof port.getInfo === 'function') {
    cachedSerialPortInfo = port.getInfo()
    persistSerialInfo(cachedSerialPortInfo)
  }
  return port
}

function cacheUsbDevice(device) {
  cachedTransport = 'usb'
  cachedUsbDevice = device
  cachedSerialPort = null
  cachedSerialPortInfo = null
  persistUsbInfo(device)
  return device
}

function findBulkOutEndpoint(device) {
  const configuration = device.configuration
  if (!configuration?.interfaces?.length) {
    throw new Error('Printer USB configuration not found')
  }

  for (const iface of configuration.interfaces) {
    for (const alternate of iface.alternates) {
      const outEndpoint = alternate.endpoints.find(
        (endpoint) => endpoint.direction === 'out' && endpoint.type === 'bulk'
      )
      if (outEndpoint) {
        return {
          interfaceNumber: iface.interfaceNumber,
          alternateSetting: alternate.alternateSetting,
          endpointNumber: outEndpoint.endpointNumber,
        }
      }
    }
  }

  throw new Error('Printer USB bulk output endpoint not found')
}

async function openUsbDevice(device) {
  if (!device.opened) {
    await device.open()
  }

  if (device.configuration == null) {
    await device.selectConfiguration(1)
  }

  return findBulkOutEndpoint(device)
}

export async function restoreCachedPrinter() {
  if (cachedTransport === 'usb' && cachedUsbDevice) return cachedUsbDevice
  if (cachedTransport === 'serial' && cachedSerialPort) return cachedSerialPort

  if (isWebUsbSupported()) {
    try {
      const devices = await navigator.usb.getDevices()
      const persisted = loadUsbInfo()
      const device = matchUsbDevice(devices, persisted)
      if (device) return cacheUsbDevice(device)
    } catch (e) {
      /* ignore */
    }
  }

  if (isWebSerialSupported()) {
    try {
      const ports = await navigator.serial.getPorts()
      const persisted = cachedSerialPortInfo || loadSerialInfo()
      const port = matchSerialPort(ports, persisted)
      if (port) return cacheSerialPort(port)
    } catch (e) {
      /* ignore */
    }
  }

  return null
}

export const restoreCachedSerialPort = restoreCachedPrinter

export async function getGrantedPrinterCount() {
  if (isSystemPrinterMode()) return 1

  let count = 0
  if (isWebUsbSupported()) {
    try {
      const devices = await navigator.usb.getDevices()
      count += devices?.length || 0
    } catch (e) {
      /* ignore */
    }
  }
  if (isWebSerialSupported()) {
    try {
      const ports = await navigator.serial.getPorts()
      count += ports?.length || 0
    } catch (e) {
      /* ignore */
    }
  }
  return count
}

export const getGrantedSerialPortCount = getGrantedPrinterCount

export function getPrinterMode() {
  try {
    return sessionStorage.getItem(PRINTER_MODE_KEY) || PRINTER_MODE_DIRECT
  } catch (e) {
    return PRINTER_MODE_DIRECT
  }
}

export function isSystemPrinterMode() {
  return getPrinterMode() === PRINTER_MODE_SYSTEM
}

export function setPrinterMode(mode) {
  try {
    sessionStorage.setItem(PRINTER_MODE_KEY, mode)
    if (mode === PRINTER_MODE_SYSTEM) {
      persistPermission('system')
    }
  } catch (e) {
    /* ignore */
  }
}

export function getPrinterBlockedHelp() {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent)
  const isWin = typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || navigator.userAgent)

  if (isMac) {
    return (
      'Epson not in USB list — macOS is using the printer driver and hiding USB from Chrome. ' +
      'Fix option A: Click "Use System Printer" in POS (easiest — uses your installed Epson). ' +
      'Fix option B: System Settings → Printers → remove Epson → unplug USB 10 sec → replug → Connect Printer in Chrome again.'
    )
  }

  if (isWin) {
    return (
      'Epson not in USB list — Windows USB Print driver is blocking browser access. ' +
      'Fix option A: Click "Use System Printer" in POS (uses installed Epson driver). ' +
      'Fix option B: Install WinUSB via Zadig (zadig.akeo.ie) for your Epson, then Connect Printer again.'
    )
  }

  return (
    'Epson not in USB list — the system printer driver is blocking browser USB access. ' +
    'Click "Use System Printer" in POS, or remove the printer from system settings and try Connect Printer again.'
  )
}

/** Use when direct USB is blocked — prints via Mac/Windows print dialog. */
export function connectSystemPrinter() {
  resetCachedPrinter()
  setPrinterMode(PRINTER_MODE_SYSTEM)
  persistPermission('system')
  return {
    transport: 'system',
    message: 'System printer mode enabled. Add Epson in laptop settings if needed; receipts will use the print dialog.',
  }
}

export function getActivePrinterTransport() {
  if (isSystemPrinterMode()) return 'system'
  return cachedTransport
}

async function requestUsbPrinter() {
  if (!isWebUsbSupported()) {
    throw new Error('WebUSB is not supported in this browser. Use Chrome or Edge on desktop.')
  }

  setPrinterMode(PRINTER_MODE_DIRECT)

  let device
  try {
    // Single dialog — list every USB device Chrome can access.
    device = await navigator.usb.requestDevice({ filters: [] })
  } catch (error) {
    if (error?.name === 'NotFoundError') {
      const blocked = new Error(getPrinterBlockedHelp())
      blocked.name = 'PrinterBlockedError'
      blocked.cause = error
      throw blocked
    }
    throw error
  }

  if (!device) {
    const blocked = new Error(getPrinterBlockedHelp())
    blocked.name = 'PrinterBlockedError'
    throw blocked
  }

  try {
    const endpointInfo = await openUsbDevice(device)
    await device.releaseInterface(endpointInfo.interfaceNumber)
    await device.close()
  } catch (error) {
    try {
      if (device.opened) await device.close()
    } catch (e) {
      /* ignore */
    }

    if (error?.name === 'SecurityError' || /access|denied|claim/i.test(error?.message || '')) {
      throw new Error(
        'USB printer is blocked by the system driver. On Windows: use Zadig to install WinUSB for the Epson. On Mac: remove the printer from System Settings → Printers, unplug/replug USB, then Connect Printer again in Chrome.'
      )
    }
    throw error
  }

  return cacheUsbDevice(device)
}

async function requestSerialPrinter() {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial is not supported in this browser.')
  }

  setPrinterMode(PRINTER_MODE_DIRECT)

  let port
  try {
    // Prefer known thermal vendors, then fall back to any COM/serial port
    port = await navigator.serial.requestPort({
      filters: THERMAL_USB_FILTERS.map((f) => ({
        usbVendorId: f.vendorId,
      })),
    })
  } catch (error) {
    if (error?.name === 'NotFoundError') {
      port = await navigator.serial.requestPort()
    } else {
      throw error
    }
  }

  if (!port) throw new Error('No serial printer port selected')
  return cacheSerialPort(port)
}

/**
 * Connect via WebUSB (direct Epson/Star/Bixolon USB).
 * Must be called from a user click.
 */
export async function connectUsbPrinter() {
  resetCachedPrinter()
  setPrinterMode(PRINTER_MODE_DIRECT)
  const device = await requestUsbPrinter()
  return { transport: 'usb', device }
}

/**
 * Connect via Web Serial (COM port / virtual serial / USB-serial adapters).
 * Must be called from a user click.
 */
export async function connectSerialPrinter() {
  resetCachedPrinter()
  setPrinterMode(PRINTER_MODE_DIRECT)
  const port = await requestSerialPrinter()
  return { transport: 'serial', port }
}

/**
 * Connect printer — tries WebUSB first (Epson), then Web Serial.
 * Must be called from a user click.
 */
export async function connectThermalPrinter() {
  resetCachedPrinter()
  setPrinterMode(PRINTER_MODE_DIRECT)

  const errors = []

  if (isWebUsbSupported()) {
    try {
      return await connectUsbPrinter()
    } catch (error) {
      if (error?.name === 'NotFoundError' || error?.name === 'PrinterBlockedError') {
        // USB picker cancelled / blocked — still allow serial attempt below unless user cancelled
        if (error?.name === 'PrinterBlockedError') {
          errors.push(error.message)
        } else {
          errors.push('No USB printer selected.')
        }
      } else if (error?.name === 'NotAllowedError') {
        errors.push('USB permission denied.')
      } else {
        errors.push(error?.message || 'USB connection failed.')
      }
    }
  } else {
    errors.push('WebUSB not available in this browser.')
  }

  if (isWebSerialSupported()) {
    try {
      return await connectSerialPrinter()
    } catch (error) {
      if (error?.name === 'NotFoundError') {
        errors.push('No serial/COM port found.')
      } else if (error?.name === 'NotAllowedError') {
        errors.push('Serial permission denied.')
      } else {
        throw error
      }
    }
  } else {
    errors.push('Web Serial not available in this browser.')
  }

  const blocked = new Error(`${errors.join(' ')} ${getPrinterBlockedHelp()}`)
  blocked.name = 'PrinterBlockedError'
  throw blocked
}

export async function acquirePrinter(options = {}) {
  const { allowRequest = true } = options

  if (!isThermalPrintingSupported()) {
    throw new Error('Thermal printing is not supported. Use Chrome or Edge on a desktop/laptop (not Safari, not iPhone/iPad).')
  }

  const restored = await restoreCachedPrinter()
  if (restored) return restored

  if (!allowRequest) {
    throw new Error(
      'Printer not connected. Click "Connect Printer" at the top of POS, select your Epson USB device, then try again.'
    )
  }

  const result = await connectThermalPrinter()
  return result.device || result.port
}

export const acquireSerialPort = acquirePrinter

export async function closeSerialPortIfOpen(port) {
  if (!port) return
  try {
    if (port.readable || port.writable) {
      await port.close()
    }
  } catch (e) {
    /* ignore */
  }
}

export async function openSerialPort(port, baudRates = BAUD_RATES) {
  await closeSerialPortIfOpen(port)

  // Prefer last successful baud if stored
  let preferred = []
  try {
    const raw = sessionStorage.getItem('thermalSerialBaud')
    if (raw) preferred = [parseInt(raw, 10)].filter((n) => Number.isFinite(n))
  } catch (e) {
    /* ignore */
  }
  const rates = [...new Set([...preferred, ...baudRates])]

  let lastError
  for (const baudRate of rates) {
    try {
      await port.open({ ...SERIAL_OPEN_BASE, baudRate })
      try {
        sessionStorage.setItem('thermalSerialBaud', String(baudRate))
      } catch (e) {
        /* ignore */
      }
      return baudRate
    } catch (error) {
      lastError = error
      await closeSerialPortIfOpen(port)
    }
  }

  throw new Error(
    lastError?.message ||
      'Could not open printer port. Check the USB cable and close any other app using the printer.'
  )
}

export async function writeToSerialPort(port, data) {
  const writer = port.writable.getWriter()
  try {
    await writer.write(data instanceof Uint8Array ? data : new Uint8Array(data))
  } finally {
    writer.releaseLock()
  }
}

async function writeToUsbDevice(device, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const endpointInfo = await openUsbDevice(device)

  try {
    await device.claimInterface(endpointInfo.interfaceNumber)
    if (endpointInfo.alternateSetting != null) {
      try {
        await device.selectAlternateInterface(
          endpointInfo.interfaceNumber,
          endpointInfo.alternateSetting
        )
      } catch (e) {
        /* some devices ignore alternate selection */
      }
    }

    for (let offset = 0; offset < bytes.length; offset += USB_CHUNK_SIZE) {
      const chunk = bytes.slice(offset, offset + USB_CHUNK_SIZE)
      const result = await device.transferOut(endpointInfo.endpointNumber, chunk)
      if (result.status !== 'ok') {
        throw new Error(`USB print transfer failed: ${result.status}`)
      }
    }
  } finally {
    try {
      await device.releaseInterface(endpointInfo.interfaceNumber)
    } catch (e) {
      /* ignore */
    }
    try {
      if (device.opened) await device.close()
    } catch (e) {
      /* ignore */
    }
  }
}

/** Send raw ESC/POS bytes using whichever transport is connected. */
export async function writeToThermalPrinter(data) {
  // If a USB/serial device is paired, always prefer silent direct print
  // even if the user previously chose system-print mode.
  const restored = await restoreCachedPrinter()
  if (!restored) {
    if (isSystemPrinterMode()) {
      throw new Error('System printer mode — use browser print instead of direct USB.')
    }
    throw new Error(
      'Printer not connected. Click "Connect USB" or "Serial/COM" and select your Epson, then try again.'
    )
  }

  // Switch back to direct mode so confirm-sale stays silent
  setPrinterMode(PRINTER_MODE_DIRECT)

  if (cachedTransport === 'usb' && cachedUsbDevice) {
    await writeToUsbDevice(cachedUsbDevice, data)
    return
  }

  if (cachedTransport === 'serial' && cachedSerialPort) {
    const port = cachedSerialPort
    await openSerialPort(port)
    try {
      await writeToSerialPort(port, data)
    } finally {
      await closeSerialPortIfOpen(port)
    }
    return
  }

  throw new Error(
    'Printer not connected. Click "Connect USB" or "Serial/COM" and select your Epson from the list.'
  )
}

/** True when a WebUSB or Web Serial printer is already paired in this browser. */
export async function hasDirectPrinterPaired() {
  if (!isThermalPrintingSupported()) return false
  if (await restoreCachedPrinter()) return true
  const count = await getGrantedPrinterCount()
  // getGrantedPrinterCount returns 1 for system mode — only count real USB/serial devices
  if (isSystemPrinterMode()) {
    let real = 0
    if (isWebUsbSupported()) {
      try {
        real += (await navigator.usb.getDevices())?.length || 0
      } catch (e) {
        /* ignore */
      }
    }
    if (isWebSerialSupported()) {
      try {
        real += (await navigator.serial.getPorts())?.length || 0
      } catch (e) {
        /* ignore */
      }
    }
    return real > 0
  }
  return count > 0
}

export async function testPrinterConnection() {
  const restored = await restoreCachedPrinter()
  if (!restored) {
    throw new Error('No printer paired yet')
  }

  if (cachedTransport === 'usb' && cachedUsbDevice) {
    const endpointInfo = await openUsbDevice(cachedUsbDevice)
    await deviceClaimRelease(cachedUsbDevice, endpointInfo.interfaceNumber)
    return { transport: 'usb', message: 'Epson USB printer connected' }
  }

  if (cachedTransport === 'serial' && cachedSerialPort) {
    await openSerialPort(cachedSerialPort)
    await closeSerialPortIfOpen(cachedSerialPort)
    return { transport: 'serial', message: 'Serial printer port connected' }
  }

  throw new Error('Printer connection could not be verified')
}

async function deviceClaimRelease(device, interfaceNumber) {
  try {
    await device.claimInterface(interfaceNumber)
  } finally {
    try {
      await device.releaseInterface(interfaceNumber)
    } catch (e) {
      /* ignore */
    }
    try {
      if (device.opened) await device.close()
    } catch (e) {
      /* ignore */
    }
  }
}

export function getPrinterSupportMessage() {
  if (isSystemPrinterMode()) {
    return 'System printer mode — tokens print via Mac/Windows print dialog (choose Epson).'
  }
  if (!isThermalPrintingSupported()) {
    return 'Use Chrome or Edge on a laptop/desktop. Safari and iPhone/iPad cannot connect USB/serial thermal printers.'
  }
  return 'Connect USB = direct Epson WebUSB. Connect Serial/COM = COM port or USB-serial adapter. System Printer = OS print dialog.'
}
